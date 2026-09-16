"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useEffect, useState } from "react";
import { Status } from "@/components/Feedback";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, errorMessage } from "@/lib/bt";
import { getSession } from "@/lib/session";
import {
  EMPTY_SCHEDULE,
  addMinutes,
  assignmentsFrom,
  autoFill,
  describeChanges,
  newId,
  place,
  scheduleErrors,
  slotAt,
  slotOf,
  unplace,
  unscheduled,
  withChanges,
  type Schedule,
} from "@/lib/schedule";

export default dynamic(
  () =>
    Promise.resolve(() => (
      <RoleGate allow={["admin"]}>
        <Layout>
          <Page />
        </Layout>
      </RoleGate>
    )),
  { ssr: false },
);

const card =
  "rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5";
const action =
  "min-h-10 rounded-md px-2 text-sm font-medium text-[var(--blue)] hover:bg-[var(--surface-2)] disabled:opacity-50";
type Placement = { teamId: string; blockId: string; roomId: string };

function Page() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [saved, setSaved] = useState<Schedule>(EMPTY_SCHEDULE);
  const [s, setS] = useState<Schedule>(EMPTY_SCHEDULE);
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<Schedule | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [picker, setPicker] = useState<Placement | null>(null);
  const [pickerError, setPickerError] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // A later edit clears undo, so restoring a placement never erases setup edits.
  function update(next: Schedule, message = "") {
    setUndo(message ? s : null);
    setS(next);
    setNotice(message);
    setError("");
  }

  async function load() {
    setBusy(true);
    setError("");
    try {
      const doc = await eventOrEmpty();
      const sched = doc.settings.schedule ?? EMPTY_SCHEDULE;
      setTeams(doc.teams);
      setJudges(doc.judges);
      setSaved(sched);
      setS(sched);
      setUndo(null);
      setNotice("");
      setSetupOpen(!sched.rooms.length || !sched.blocks.length);
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  const judgeName = (id: string) => judges.find((j) => j.id === id)?.name ?? id;
  const free = unscheduled(s, teams);
  const errors = scheduleErrors(s, teams, judges);
  const cells = s.blocks.flatMap((b) =>
    s.rooms.map((r) => ({
      blockId: b.id,
      roomId: r.id,
      label: `${b.startsAt} · ${b.label} · ${r.name}`,
    })),
  );
  const available = (
    cell: { blockId: string; roomId: string },
    teamId: string,
  ) => !slotAt(s, cell.blockId, cell.roomId).some((x) => x.teamId !== teamId);
  const openCells = cells.filter((c) => available(c, "")).length;

  function openPicker(teamId = "", cell?: { blockId: string; roomId: string }) {
    const target =
      cell ?? slotOf(s, teamId) ?? cells.find((c) => available(c, teamId));
    setPicker({
      teamId,
      blockId: target?.blockId ?? "",
      roomId: target?.roomId ?? "",
    });
    setPickerError("");
  }

  function move(teamId: string, blockId: string, roomId: string) {
    try {
      const before = slotOf(s, teamId);
      if (before?.blockId === blockId && before.roomId === roomId) return true;
      update(
        place(s, teamId, blockId, roomId),
        `${teamName(teamId)} ${before ? "moved" : "scheduled"}.`,
      );
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }
  function unschedule(teamId: string) {
    if (slotOf(s, teamId))
      update(unplace(s, teamId), `${teamName(teamId)} moved to Unscheduled.`);
  }
  const dragProps = (teamId: string) => ({
    draggable: !busy,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", teamId);
      e.dataTransfer.effectAllowed = "move";
      setDragging(teamId);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });
  const dropProps = (key: string, onDrop: (id: string) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(key);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || dragging;
      if (id && !busy && teams.some((t) => t.id === id)) onDrop(id);
      setDragging(null);
      setOver(null);
    },
  });
  const dropRing = (key: string) =>
    over === key ? "ring-2 ring-[var(--blue)]" : "";

  async function save() {
    if (busy) return;
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = withChanges(
        s,
        describeChanges(saved, s, teams),
        getSession()?.id,
      );
      const doc = await saveEvent((d) => {
        if (
          JSON.stringify(d.settings.schedule ?? EMPTY_SCHEDULE) !==
          JSON.stringify(saved)
        )
          throw new Error(
            "The schedule changed elsewhere. Your edits are still here. Discard and reload to get the latest version.",
          );
        const latestErrors = scheduleErrors(next, d.teams, d.judges);
        if (latestErrors.length) throw new Error(latestErrors[0]);
        return {
          ...d,
          settings: { ...d.settings, schedule: next },
          judges: assignmentsFrom(next, d.judges),
        };
      });
      const stored = doc.settings.schedule ?? EMPTY_SCHEDULE;
      setSaved(stored);
      setS(stored);
      setTeams(doc.teams);
      setJudges(doc.judges);
      setUndo(null);
      setNotice(
        "Published. Team schedules and judge assignments are up to date.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function addRoom() {
    update({
      ...s,
      rooms: [
        ...s.rooms,
        {
          id: newId("room"),
          name: `Room ${String.fromCharCode(65 + s.rooms.length)}`,
          judgeIds: [],
        },
      ],
    });
  }
  function addBlock() {
    const last = s.blocks[s.blocks.length - 1];
    const block = {
      id: newId("blk"),
      label: `Block ${s.blocks.length + 1}`,
      startsAt: last ? addMinutes(last.startsAt, minutes) : "09:00",
    };
    update({ ...s, blocks: [...s.blocks, block] });
    return block;
  }
  function removeRoom(id: string) {
    const count = s.slots.filter((x) => x.roomId === id).length;
    const name = s.rooms.find((r) => r.id === id)?.name;
    if (
      count &&
      !confirm(
        `Remove ${name}? ${count} ${count === 1 ? "team" : "teams"} will return to Unscheduled.`,
      )
    )
      return;
    update(
      {
        ...s,
        rooms: s.rooms.filter((r) => r.id !== id),
        slots: s.slots.filter((x) => x.roomId !== id),
      },
      `${name} removed.`,
    );
  }
  function removeBlock(id: string) {
    const count = s.slots.filter((x) => x.blockId === id).length;
    const name = s.blocks.find((b) => b.id === id)?.label;
    if (
      count &&
      !confirm(
        `Remove ${name}? ${count} ${count === 1 ? "team" : "teams"} will return to Unscheduled.`,
      )
    )
      return;
    update(
      {
        ...s,
        blocks: s.blocks.filter((b) => b.id !== id),
        slots: s.slots.filter((x) => x.blockId !== id),
        activeBlockId: s.activeBlockId === id ? undefined : s.activeBlockId,
      },
      `${name} removed.`,
    );
  }
  function toggleJudge(roomId: string, judgeId: string) {
    update({
      ...s,
      rooms: s.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              judgeIds: r.judgeIds.includes(judgeId)
                ? r.judgeIds.filter((j) => j !== judgeId)
                : [...r.judgeIds, judgeId],
            }
          : r,
      ),
    });
  }

  if (!loaded) return <Status loading={!error} error={error} onRetry={load} />;

  return (
    <fieldset
      disabled={busy}
      data-unsaved={dirty}
      className="max-w-7xl space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-[var(--ink-3)]">
            Arrange teams here. Publish when ready for judges and teams to see
            changes.
          </p>
        </div>
        {saved.slots.length > 0 && (
          <a
            href="/schedule/board"
            target="_blank"
            rel="noreferrer"
            className="ux-secondary"
          >
            View published schedule ↗
          </a>
        )}
      </div>

      <details
        className={card}
        open={setupOpen}
        onToggle={(e) => setSetupOpen(e.currentTarget.open)}
      >
        <summary className="font-semibold">
          Rooms & time blocks{" "}
          <span className="ml-2 text-sm font-normal text-[var(--ink-3)]">
            {s.rooms.length} rooms · {s.blocks.length} blocks
          </span>
        </summary>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <section aria-label="Room setup" className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">1. Rooms & judges</h2>
              <button className="ux-secondary" onClick={addRoom}>
                Add room
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {s.rooms.map((r) => (
                <div
                  key={r.id}
                  className="space-y-3 border-b border-[var(--line)] pb-4"
                >
                  <div className="flex items-end gap-2">
                    <label className="ux-label min-w-0 flex-1">
                      Room name
                      <input
                        className="ux-input"
                        value={r.name}
                        onChange={(e) =>
                          update({
                            ...s,
                            rooms: s.rooms.map((x) =>
                              x.id === r.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      className={action}
                      aria-label={`Remove ${r.name}`}
                      onClick={() => removeRoom(r.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="ux-label">
                    Usher (optional)
                    <input
                      className="ux-input"
                      value={r.usher ?? ""}
                      onChange={(e) =>
                        update({
                          ...s,
                          rooms: s.rooms.map((x) =>
                            x.id === r.id
                              ? { ...x, usher: e.target.value || undefined }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Judges</legend>
                    <div className="flex flex-wrap gap-2">
                      {judges.map((j) => (
                        <label
                          key={j.id}
                          className="flex min-h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={r.judgeIds.includes(j.id)}
                            onChange={() => toggleJudge(r.id, j.id)}
                          />
                          {j.name}
                        </label>
                      ))}
                      {!judges.length && (
                        <Link className={action} href="/admin/judges">
                          Add judges first →
                        </Link>
                      )}
                    </div>
                  </fieldset>
                </div>
              ))}
              {!s.rooms.length && (
                <p className="text-sm text-[var(--ink-3)]">
                  Add a room, then select its judges.
                </p>
              )}
            </div>
          </section>
          <section aria-label="Time block setup" className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">2. Time blocks</h2>
              <button className="ux-secondary" onClick={() => addBlock()}>
                Add time block
              </button>
            </div>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              Spacing for new blocks
              <input
                aria-label="Minutes between new blocks"
                type="number"
                min={1}
                max={240}
                className="ux-input !w-20"
                value={minutes}
                onChange={(e) =>
                  setMinutes(
                    Math.min(
                      240,
                      Math.max(1, Math.round(Number(e.target.value)) || 1),
                    ),
                  )
                }
              />
              min
            </label>
            <div className="mt-3 space-y-3">
              {s.blocks.map((b) => (
                <div key={b.id} className="flex flex-wrap items-end gap-2">
                  <label className="ux-label min-w-24 flex-1">
                    Label
                    <input
                      className="ux-input"
                      value={b.label}
                      onChange={(e) =>
                        update({
                          ...s,
                          blocks: s.blocks.map((x) =>
                            x.id === b.id ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="ux-label">
                    Start time
                    <input
                      aria-label={`Start time for ${b.label}`}
                      type="time"
                      className="ux-input"
                      value={b.startsAt}
                      onChange={(e) =>
                        update({
                          ...s,
                          blocks: s.blocks.map((x) =>
                            x.id === b.id
                              ? { ...x, startsAt: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className={action}
                    aria-label={`Remove ${b.label}`}
                    onClick={() => removeBlock(b.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!s.blocks.length && (
                <p className="text-sm text-[var(--ink-3)]">
                  Add your first start time. Schedule remaining teams can add
                  more blocks.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>

      <section className={card} aria-label="Team schedule">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Team schedule</h2>
            <p className="mt-1 text-sm text-[var(--ink-3)]">
              {teams.length - free.length} of {teams.length} teams scheduled ·{" "}
              {openCells} empty {openCells === 1 ? "slot" : "slots"}
            </p>
          </div>
          <button
            className="ux-secondary"
            disabled={!s.rooms.length || !free.length}
            onClick={() => {
              const next = autoFill(s, teams, minutes);
              const added = next.blocks.length - s.blocks.length;
              update(
                next,
                `${free.length} ${free.length === 1 ? "team" : "teams"} scheduled${added ? `; ${added} ${added === 1 ? "time block" : "time blocks"} added` : ""}.`,
              );
            }}
          >
            Schedule remaining teams
          </button>
        </div>
        <div
          {...dropProps("tray", unschedule)}
          className={`mt-4 rounded-lg border border-dashed border-[var(--line)] p-3 ${dropRing("tray")}`}
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-semibold">
              Unscheduled · {free.length}
            </h3>
            <span className="text-xs text-[var(--ink-3)]">
              Unscheduling keeps the team in the event.
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {free.map((t) => (
              <div
                key={t.id}
                {...dragProps(t.id)}
                className={`flex max-w-full items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 ${dragging === t.id ? "opacity-40" : ""}`}
              >
                <span className="min-w-0 break-words text-sm">{t.name}</span>
                <button
                  className={action}
                  aria-label={`Schedule ${t.name}`}
                  onClick={() => openPicker(t.id)}
                >
                  Schedule
                </button>
              </div>
            ))}
            {!free.length && (
              <p className="text-sm text-[var(--ink-3)]">
                {teams.length ? (
                  "All teams have a slot."
                ) : (
                  <>
                    No teams yet.{" "}
                    <Link className="underline" href="/admin/teams">
                      Add teams →
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--ink-3)]">
            Use the buttons below, or drag teams between empty slots.
          </p>
          {s.blocks.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              Now presenting
              <select
                aria-label="Now presenting"
                className="ux-input !w-auto max-w-full"
                value={s.activeBlockId ?? ""}
                onChange={(e) =>
                  update({ ...s, activeBlockId: e.target.value || undefined })
                }
              >
                <option value="">No active block</option>
                {s.blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} · {b.startsAt}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div
          className="mt-3 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Schedule grid"
        >
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-28 bg-[var(--surface)] p-3 text-left"
                >
                  Time block
                </th>
                {s.rooms.map((r) => (
                  <th
                    scope="col"
                    key={r.id}
                    className="p-3 text-left align-top"
                  >
                    <div className="font-semibold">{r.name}</div>
                    <div className="mt-1 text-xs font-normal text-[var(--ink-3)]">
                      {r.judgeIds.map(judgeName).join(", ") ||
                        "No judges selected"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.blocks.map((b) => (
                <tr key={b.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-[var(--line)] bg-[var(--surface)] p-3 text-left align-top"
                  >
                    <div>{b.label}</div>
                    <div className="mt-1 text-xs font-normal text-[var(--ink-3)]">
                      {b.startsAt}
                    </div>
                    {s.activeBlockId === b.id && (
                      <span className="mt-2 inline-block text-xs font-medium text-[var(--blue)]">
                        {s.activeBlockId === saved.activeBlockId
                          ? "Now presenting"
                          : "Active on publish"}
                      </span>
                    )}
                  </th>
                  {s.rooms.map((r) => (
                    <td
                      key={r.id}
                      {...dropProps(`${b.id}|${r.id}`, (id) =>
                        move(id, b.id, r.id),
                      )}
                      className={`min-w-52 border-t border-l border-[var(--line)] p-2 align-top ${dropRing(`${b.id}|${r.id}`)}`}
                    >
                      <div className="space-y-2">
                        {slotAt(s, b.id, r.id).map((x) => (
                          <div
                            key={x.teamId}
                            {...dragProps(x.teamId)}
                            className={`rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 ${dragging === x.teamId ? "opacity-40" : ""}`}
                          >
                            <div className="break-words font-medium">
                              {teamName(x.teamId)}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <button
                                className={action}
                                aria-label={`Move ${teamName(x.teamId)}`}
                                onClick={() => openPicker(x.teamId)}
                              >
                                Move
                              </button>
                              <button
                                className={`${action} !text-[var(--ink-3)]`}
                                aria-label={`Unschedule ${teamName(x.teamId)}`}
                                onClick={() => unschedule(x.teamId)}
                              >
                                Unschedule
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!slotAt(s, b.id, r.id).length && (
                        <button
                          className="min-h-24 w-full rounded-lg border border-dashed border-[var(--line)] px-3 py-5 text-sm text-[var(--blue)] disabled:text-[var(--ink-3)]"
                          disabled={!free.length}
                          aria-label={`Add team to ${b.label}, ${r.name}`}
                          onClick={() =>
                            openPicker("", { blockId: b.id, roomId: r.id })
                          }
                        >
                          {free.length ? "+ Add team" : "Empty slot"}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!s.rooms.length || !s.blocks.length) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span>
              Add {s.rooms.length ? "a time block" : "rooms and time blocks"} to
              place teams.
            </span>
            <button className="ux-secondary" onClick={() => setSetupOpen(true)}>
              Set up schedule
            </button>
          </div>
        )}
        {s.rooms.length > 0 && s.blocks.length > 0 && (
          <button className={`${action} mt-3`} onClick={() => addBlock()}>
            + Add time block
          </button>
        )}
        {notice && (
          <div className="mt-3 flex flex-wrap items-center gap-3" role="status">
            <span className="text-sm">{notice}</span>
            {undo && (
              <button
                className={action}
                onClick={() => {
                  setS(undo);
                  setUndo(null);
                  setNotice("Change undone.");
                  setError("");
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
        <Status error={error} />
        {errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-400/50 p-3 text-sm">
            <h3 className="font-semibold">Before publishing</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <button
              className={`${action} mt-2`}
              onClick={() => setSetupOpen(true)}
            >
              Edit rooms & time blocks
            </button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <div className="text-sm">
            <span className="font-medium">
              {dirty ? "Unpublished changes" : "No unpublished changes"}
            </span>
            {free.length > 0 && (
              <p className="mt-1 text-[var(--ink-3)]">
                {free.length} {free.length === 1 ? "team is" : "teams are"}{" "}
                unscheduled.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="ux-secondary"
              disabled={!dirty || busy}
              onClick={() => {
                if (confirm("Discard unsaved changes and reload?")) void load();
              }}
            >
              Discard changes
            </button>
            <button
              className="ux-primary"
              disabled={!dirty || busy || errors.length > 0}
              onClick={save}
            >
              {busy ? "Publishing…" : "Save & publish"}
            </button>
          </div>
        </div>
      </section>

      <details className={card}>
        <summary className="font-semibold">Published changes</summary>
        <ul className="mt-3 space-y-2 text-sm">
          {saved.changes.slice(0, 40).map((c, i) => (
            <li key={i}>
              <span className="mr-3 text-xs text-[var(--ink-3)]">
                {new Date(c.at).toLocaleString()}
              </span>
              {c.message}
            </li>
          ))}
          {!saved.changes.length && (
            <li className="text-[var(--ink-3)]">
              Changes appear here after publishing.
            </li>
          )}
        </ul>
      </details>

      <Dialog
        open={picker !== null}
        onClose={() => setPicker(null)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-[rgba(0,0,0,0.3)]" />
        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel className="w-full max-w-lg rounded-xl bg-[var(--surface)] p-6 shadow-xl">
              {picker && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!picker.teamId || !picker.blockId || !picker.roomId) {
                      setPickerError("Choose a team and an empty slot.");
                      return;
                    }
                    if (move(picker.teamId, picker.blockId, picker.roomId))
                      setPicker(null);
                    else
                      setPickerError(
                        "That slot is occupied. Choose an empty slot.",
                      );
                  }}
                  className="space-y-5"
                >
                  <DialogTitle className="text-xl font-semibold">
                    {slotOf(s, picker.teamId)
                      ? `Move ${teamName(picker.teamId)}`
                      : "Schedule a team"}
                  </DialogTitle>
                  {!slotOf(s, picker.teamId) && (
                    <label className="ux-label">
                      Team
                      <select
                        data-autofocus
                        className="ux-input"
                        value={picker.teamId}
                        onChange={(e) => {
                          setPicker({ ...picker, teamId: e.target.value });
                          setPickerError("");
                        }}
                        required
                      >
                        <option value="">Choose a team</option>
                        {free.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="ux-label">
                    Time & room
                    <select
                      data-autofocus={!!slotOf(s, picker.teamId) || undefined}
                      className="ux-input"
                      value={
                        picker.blockId && picker.roomId
                          ? `${picker.blockId}|${picker.roomId}`
                          : ""
                      }
                      onChange={(e) => {
                        const [blockId, roomId] = e.target.value.split("|");
                        setPicker({ ...picker, blockId, roomId });
                        setPickerError("");
                      }}
                      required
                    >
                      <option value="">Choose an empty slot</option>
                      {cells.map((c) => (
                        <option
                          key={`${c.blockId}|${c.roomId}`}
                          value={`${c.blockId}|${c.roomId}`}
                          disabled={!available(c, picker.teamId)}
                        >
                          {c.label}
                          {!available(c, picker.teamId)
                            ? ` — occupied by ${slotAt(s, c.blockId, c.roomId)
                                .map((x) => teamName(x.teamId))
                                .join(", ")}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!openCells && (
                    <p className="text-sm text-[var(--ink-3)]">
                      {s.rooms.length
                        ? "Need another slot? Add a time block."
                        : "Add a room before scheduling teams."}
                    </p>
                  )}
                  {s.rooms.length > 0 ? (
                    <button
                      type="button"
                      className="ux-secondary"
                      onClick={() => {
                        const b = addBlock();
                        setPicker({
                          ...picker,
                          blockId: b.id,
                          roomId: picker.roomId || s.rooms[0].id,
                        });
                        setPickerError("");
                      }}
                    >
                      + Add time block
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ux-secondary"
                      onClick={() => {
                        setPicker(null);
                        setSetupOpen(true);
                      }}
                    >
                      Set up rooms
                    </button>
                  )}
                  <Status error={pickerError} />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="ux-secondary"
                      onClick={() => setPicker(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="ux-primary"
                      disabled={
                        !picker.teamId ||
                        !picker.blockId ||
                        !picker.roomId ||
                        (slotOf(s, picker.teamId)?.blockId === picker.blockId &&
                          slotOf(s, picker.teamId)?.roomId === picker.roomId)
                      }
                    >
                      {slotOf(s, picker.teamId) ? "Move team" : "Schedule team"}
                    </button>
                  </div>
                </form>
              )}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </fieldset>
  );
}
