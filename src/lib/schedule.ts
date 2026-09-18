import type { Judge, JudgingSchedule, JudgingTeam } from "@ubc-biztech/sdk";

export type Schedule = JudgingSchedule;
export type Room = Schedule["rooms"][number];
export type Block = Schedule["blocks"][number];
export type Slot = Schedule["slots"][number];

export const EMPTY_SCHEDULE: Schedule = {
  rooms: [],
  blocks: [],
  slots: [],
  changes: [],
};

export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const slotAt = (s: Schedule, blockId: string, roomId: string) =>
  s.slots.filter((x) => x.blockId === blockId && x.roomId === roomId);
export const slotOf = (s: Schedule, teamId: string) =>
  s.slots.find((x) => x.teamId === teamId);
export const unscheduled = <T extends Pick<JudgingTeam, "id">>(
  s: Schedule,
  teams: T[],
): T[] => teams.filter((t) => !slotOf(s, t.id));
/** Two teams in one room at one time: fine mid-swap, never publishable. */
export const isDoubleBooked = (s: Schedule, blockId: string, roomId: string) =>
  slotAt(s, blockId, roomId).length > 1;

/** Every judge's teams, in block order, from the room they sit in. Judges in no room keep an empty list. */
export const isExcluded = (s: Schedule, judgeId: string, teamId: string) =>
  (s.exclusions ?? []).some(
    (e) => e.judgeId === judgeId && e.teamId === teamId,
  );

export function assignmentsFrom<
  J extends Pick<Partial<Judge>, "id" | "assignedTeamIds">,
>(s: Schedule, judges: J[]): J[] {
  const blockOrder = new Map(s.blocks.map((b, i) => [b.id, i]));
  return judges.map((j) => {
    const rooms = s.rooms
      .filter((r) => j.id && r.judgeIds.includes(j.id))
      .map((r) => r.id);
    const teams = s.slots
      .filter(
        (x) =>
          rooms.includes(x.roomId) && !(j.id && isExcluded(s, j.id, x.teamId)),
      )
      .sort(
        (a, b) =>
          (blockOrder.get(a.blockId) ?? 0) - (blockOrder.get(b.blockId) ?? 0),
      )
      .map((x) => x.teamId);
    return { ...j, assignedTeamIds: [...new Set(teams)] };
  });
}

/** Human-readable diff of where each team sits, for the change log. */
export function describeChanges(
  before: Schedule,
  after: Schedule,
  teams: Pick<JudgingTeam, "id" | "name">[],
): string[] {
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
    else if (JSON.stringify(prev.judgeIds) !== JSON.stringify(r.judgeIds))
      out.push(`${r.name}: judges changed`);
  }
  for (const r of before.rooms)
    if (!after.rooms.some((x) => x.id === r.id))
      out.push(`Room removed: ${r.name}`);
  for (const b of after.blocks) {
    const prev = before.blocks.find((x) => x.id === b.id);
    if (!prev) out.push(`Block added: ${b.label} at ${b.startsAt}`);
    else if (prev.startsAt !== b.startsAt)
      out.push(`${b.label}: ${prev.startsAt} → ${b.startsAt}`);
  }
  for (const b of before.blocks)
    if (!after.blocks.some((x) => x.id === b.id))
      out.push(`Block removed: ${b.label}`);
  const key = (e: { judgeId: string; teamId: string }) =>
    `${e.judgeId}|${e.teamId}`;
  const was = new Set((before.exclusions ?? []).map(key));
  const now = new Set((after.exclusions ?? []).map(key));
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  for (const e of after.exclusions ?? [])
    if (!was.has(key(e)))
      out.push(`Judge ${e.judgeId} excused from ${name(e.teamId)}`);
  for (const e of before.exclusions ?? [])
    if (!now.has(key(e)))
      out.push(`Judge ${e.judgeId} back on ${name(e.teamId)}`);
  if (before.activeBlockId !== after.activeBlockId) {
    const label = (s: Schedule) =>
      s.blocks.find((b) => b.id === s.activeBlockId)?.label ?? "none";
    out.push(`Active block: ${label(before)} → ${label(after)}`);
  }
  return out;
}

export function withChanges(
  s: Schedule,
  messages: string[],
  by?: string,
): Schedule {
  if (!messages.length) return s;
  const at = new Date().toISOString();
  return {
    ...s,
    changes: [
      ...messages.map((message) => ({ at, message, by })),
      ...s.changes,
    ].slice(0, 200),
  };
}

/**
 * Move a team to a block and room; the team's previous slot is dropped. Dropping onto a
 * taken slot double-books it, which is allowed while swapping two teams around; publishing
 * is what refuses it, via `scheduleErrors`.
 */
export function place(
  s: Schedule,
  teamId: string,
  blockId: string,
  roomId: string,
): Schedule {
  if (
    !s.blocks.some((b) => b.id === blockId) ||
    !s.rooms.some((r) => r.id === roomId)
  )
    throw new Error("Choose an existing room and time block.");
  return {
    ...s,
    slots: [
      ...s.slots.filter((x) => x.teamId !== teamId),
      { blockId, roomId, teamId },
    ],
  };
}
export const unplace = (s: Schedule, teamId: string): Schedule => ({
  ...s,
  slots: s.slots.filter((x) => x.teamId !== teamId),
});

/** Round-robin every unscheduled team across rooms, filling each block before starting the next. */
export function autoFill(
  s: Schedule,
  teams: Pick<JudgingTeam, "id">[],
  minutesPerBlock = 15,
): Schedule {
  if (!s.rooms.length) return s;
  let out = s;
  const queue = unscheduled(s, teams);
  let bi = 0;
  while (queue.length) {
    if (!out.blocks[bi]) {
      const last = out.blocks[out.blocks.length - 1];
      out = {
        ...out,
        blocks: [
          ...out.blocks,
          {
            id: newId("blk"),
            label: `Block ${out.blocks.length + 1}`,
            startsAt: addMinutes(
              last?.startsAt ?? "09:00",
              last ? minutesPerBlock : 0,
            ),
          },
        ],
      };
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
  const total =
    (Number(m[1]) * 60 + Number(m[2]) + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Validate again against fresh teams/judges before publishing the draft. */
export function scheduleErrors(
  s: Schedule,
  teams: { id?: string; name: string }[],
  judges: { id?: string; name: string }[],
): string[] {
  const errors = new Set<string>();
  const seenTeams = new Set<string>();
  const seenCells = new Set<string>();
  const seenJudges = new Map<string, string>();
  const times = new Set<string>();
  for (const r of s.rooms) {
    if (!r.name.trim()) errors.add("Give every room a name.");
    if (r.judgeIds.some((id) => !judges.some((j) => j.id === id)))
      errors.add(`${r.name}: a judge was removed. Reload the schedule.`);
  }
  for (const b of s.blocks) {
    if (!b.label.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.startsAt))
      errors.add("Give every time block a label and valid start time.");
    if (times.has(b.startsAt))
      errors.add(`${b.startsAt}: time blocks must have different start times.`);
    times.add(b.startsAt);
  }
  for (const x of s.slots) {
    const team = teams.find((t) => t.id === x.teamId);
    const room = s.rooms.find((r) => r.id === x.roomId);
    const block = s.blocks.find((b) => b.id === x.blockId);
    if (!team || !room || !block) {
      errors.add(
        "A scheduled team, room, or time block was removed. Reload the schedule.",
      );
      continue;
    }
    if (seenTeams.has(x.teamId))
      errors.add(
        `${team.name} is scheduled more than once. Unschedule it, then choose one slot.`,
      );
    seenTeams.add(x.teamId);
    const cell = `${x.blockId}|${x.roomId}`;
    if (seenCells.has(cell))
      errors.add(
        `${block.label} / ${room.name} is double-booked. Move a team to an empty slot.`,
      );
    seenCells.add(cell);
    const assigned = room.judgeIds.filter((id) => !isExcluded(s, id, x.teamId));
    if (!assigned.length)
      errors.add(
        `${team.name} has no judges. Assign judges to ${room.name} or check assignment exclusions.`,
      );
    for (const id of assigned) {
      const key = `${block.startsAt}|${id}`;
      const otherRoom = seenJudges.get(key);
      if (otherRoom && otherRoom !== room.id)
        errors.add(
          `${judges.find((j) => j.id === id)?.name ?? "A judge"} is in two rooms at ${block.startsAt}. Move a team or change room judges.`,
        );
      seenJudges.set(key, room.id);
    }
  }
  return [...errors];
}

export function toggleExclusion(
  s: Schedule,
  judgeId: string,
  teamId: string,
): Schedule {
  const list = s.exclusions ?? [];
  return {
    ...s,
    exclusions: isExcluded(s, judgeId, teamId)
      ? list.filter((e) => !(e.judgeId === judgeId && e.teamId === teamId))
      : [...list, { judgeId, teamId }],
  };
}

/** Excuse a judge from every team their rooms judge in `blockId` and later blocks. */
export function excludeFromBlock(
  s: Schedule,
  judgeId: string,
  blockId: string,
): Schedule {
  const from = s.blocks.findIndex((b) => b.id === blockId);
  if (from < 0) return s;
  const later = new Set(s.blocks.slice(from).map((b) => b.id));
  const rooms = s.rooms
    .filter((r) => r.judgeIds.includes(judgeId))
    .map((r) => r.id);
  const add = s.slots
    .filter(
      (x) =>
        rooms.includes(x.roomId) &&
        later.has(x.blockId) &&
        !isExcluded(s, judgeId, x.teamId),
    )
    .map((x) => ({ judgeId, teamId: x.teamId }));
  return { ...s, exclusions: [...(s.exclusions ?? []), ...add] };
}
