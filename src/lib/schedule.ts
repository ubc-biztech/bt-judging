import type { Judge, JudgingSchedule, JudgingTeam } from "@ubc-biztech/sdk";

export type Schedule = JudgingSchedule;
export type Room = Schedule["rooms"][number];
export type Block = Schedule["blocks"][number];
export type Slot = Schedule["slots"][number];

export const EMPTY_SCHEDULE: Schedule = { rooms: [], blocks: [], slots: [], changes: [] };

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const slotAt = (s: Schedule, blockId: string, roomId: string) => s.slots.filter((x) => x.blockId === blockId && x.roomId === roomId);
export const slotOf = (s: Schedule, teamId: string) => s.slots.find((x) => x.teamId === teamId);
export const unscheduled = <T extends Pick<JudgingTeam, "id">>(s: Schedule, teams: T[]): T[] => teams.filter((t) => !slotOf(s, t.id));

/** Every judge's teams, in block order, from the room they sit in. Judges in no room keep an empty list. */
export function assignmentsFrom<J extends Pick<Partial<Judge>, "id" | "assignedTeamIds">>(s: Schedule, judges: J[]): J[] {
  const blockOrder = new Map(s.blocks.map((b, i) => [b.id, i]));
  return judges.map((j) => {
    const rooms = s.rooms.filter((r) => j.id && r.judgeIds.includes(j.id)).map((r) => r.id);
    const teams = s.slots
      .filter((x) => rooms.includes(x.roomId))
      .sort((a, b) => (blockOrder.get(a.blockId) ?? 0) - (blockOrder.get(b.blockId) ?? 0))
      .map((x) => x.teamId);
    return { ...j, assignedTeamIds: [...new Set(teams)] };
  });
}

/** Human-readable diff of where each team sits, for the change log. */
export function describeChanges(before: Schedule, after: Schedule, teams: Pick<JudgingTeam, "id" | "name">[]): string[] {
  const where = (s: Schedule, teamId: string) => {
    const slot = slotOf(s, teamId);
    if (!slot) return "unscheduled";
    const b = s.blocks.find((x) => x.id === slot.blockId)?.label ?? "?";
    const r = s.rooms.find((x) => x.id === slot.roomId)?.name ?? "?";
    return `${b} / ${r}`;
  };
  const out: string[] = [];
  for (const t of teams) {
    const [a, b] = [where(before, t.id), where(after, t.id)];
    if (a !== b) out.push(`${t.name}: ${a} → ${b}`);
  }
  for (const r of after.rooms) {
    const prev = before.rooms.find((x) => x.id === r.id);
    if (!prev) out.push(`Room added: ${r.name}`);
    else if (JSON.stringify(prev.judgeIds) !== JSON.stringify(r.judgeIds)) out.push(`${r.name}: judges changed`);
  }
  for (const r of before.rooms) if (!after.rooms.some((x) => x.id === r.id)) out.push(`Room removed: ${r.name}`);
  for (const b of after.blocks) {
    const prev = before.blocks.find((x) => x.id === b.id);
    if (!prev) out.push(`Block added: ${b.label} at ${b.startsAt}`);
    else if (prev.startsAt !== b.startsAt) out.push(`${b.label}: ${prev.startsAt} → ${b.startsAt}`);
  }
  for (const b of before.blocks) if (!after.blocks.some((x) => x.id === b.id)) out.push(`Block removed: ${b.label}`);
  return out;
}

export function withChanges(s: Schedule, messages: string[]): Schedule {
  if (!messages.length) return s;
  const at = new Date().toISOString();
  return { ...s, changes: [...messages.map((message) => ({ at, message })), ...s.changes].slice(0, 200) };
}

/** Move a team to a block and room; the team's previous slot is dropped. */
export function place(s: Schedule, teamId: string, blockId: string, roomId: string): Schedule {
  return { ...s, slots: [...s.slots.filter((x) => x.teamId !== teamId), { blockId, roomId, teamId }] };
}
export const unplace = (s: Schedule, teamId: string): Schedule => ({ ...s, slots: s.slots.filter((x) => x.teamId !== teamId) });

/** Push a team to the next block in the same room, creating a block after the last one if needed. */
export function delay(s: Schedule, teamId: string, minutesPerBlock = 15): Schedule {
  const slot = slotOf(s, teamId);
  if (!slot) return s;
  const i = s.blocks.findIndex((b) => b.id === slot.blockId);
  let next = s.blocks[i + 1];
  let out = s;
  if (!next) {
    next = { id: newId("blk"), label: `Block ${s.blocks.length + 1}`, startsAt: addMinutes(s.blocks[i]?.startsAt ?? "", minutesPerBlock) };
    out = { ...s, blocks: [...s.blocks, next] };
  }
  return place(out, teamId, next.id, slot.roomId);
}

/** Round-robin every unscheduled team across rooms, filling each block before starting the next. */
export function autoFill(s: Schedule, teams: Pick<JudgingTeam, "id">[], minutesPerBlock = 15): Schedule {
  if (!s.rooms.length) return s;
  let out = s;
  const queue = unscheduled(s, teams);
  let bi = 0;
  while (queue.length) {
    if (!out.blocks[bi]) {
      const last = out.blocks[out.blocks.length - 1];
      out = { ...out, blocks: [...out.blocks, { id: newId("blk"), label: `Block ${out.blocks.length + 1}`, startsAt: addMinutes(last?.startsAt ?? "09:00", last ? minutesPerBlock : 0) }] };
    }
    const block = out.blocks[bi]!;
    for (const room of out.rooms) {
      if (slotAt(out, block.id, room.id).length) continue;
      const team = queue.shift();
      if (!team) break;
      out = place(out, team.id, block.id, room.id);
    }
    bi += 1;
  }
  return out;
}

/** "13:05" + 15 → "13:20". Anything that is not HH:MM is returned unchanged. */
export function addMinutes(hhmm: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const total = (Number(m[1]) * 60 + Number(m[2]) + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
