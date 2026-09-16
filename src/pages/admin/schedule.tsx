"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
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
  delay,
  describeChanges,
  newId,
  place,
  slotAt,
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
  "rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
const input =
  "rounded-md border border-white/10 bg-[#0b0b0c] px-2 py-1 text-sm text-slate-100";
const btn =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50";
const chipBtn =
  "rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100";

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
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

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
  const dropProps = (key: string, onDrop: (teamId: string) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: () => over === key && setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || dragging;
      if (id && !busy && teams.some((t) => t.id === id)) onDrop(id);
      setDragging(null);
      setOver(null);
    },
  });
  const dropRing = (key: string) =>
    over === key ? "ring-2 ring-cyan-300/60 bg-cyan-300/10" : "";

  function load() {
    setError("");
    eventOrEmpty()
      .then((doc) => {
        setLoaded(true);
        setTeams(doc.teams);
        setJudges(doc.judges);
        const sched = doc.settings.schedule ?? EMPTY_SCHEDULE;
        setSaved(sched);
        setS(sched);
      })
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, []);

  const dirty = useMemo(
    () => JSON.stringify(s) !== JSON.stringify(saved),
    [s, saved],
  );
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  const judgeName = (id: string) => judges.find((j) => j.id === id)?.name ?? id;
  const free = unscheduled(s, teams);

  async function save() {
    if (busy) return;
    setNotice("");
    if (
      s.rooms.some((r) => !r.name.trim()) ||
      s.blocks.some((b) => !b.label.trim() || !b.startsAt)
    ) {
      setError(
        "Give every room a name and every block a label and start time.",
      );
      return;
    }
    setBusy(true);
    setError("");
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
            "The schedule changed elsewhere. Keep your edits, or discard and reload before saving.",
          );
        return {
          ...d,
          settings: { ...d.settings, schedule: next },
          judges: assignmentsFrom(next, d.judges),
        };
      });
      const stored = doc.settings.schedule ?? EMPTY_SCHEDULE;
      setSaved(stored);
      setS(stored);
      setJudges(doc.judges);
      setNotice("Saved and published.");
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  const addRoom = () =>
    setS({
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
  const addBlock = () => {
    const last = s.blocks[s.blocks.length - 1];
    setS({
      ...s,
      blocks: [
        ...s.blocks,
        {
          id: newId("blk"),
          label: `Block ${s.blocks.length + 1}`,
          startsAt: last ? addMinutes(last.startsAt, minutes) : "09:00",
        },
      ],
    });
  };
  const removeRoom = (id: string) =>
    (!s.slots.some((x) => x.roomId === id) ||
      confirm("Remove this room and unschedule its teams?")) &&
    setS({
      ...s,
      rooms: s.rooms.filter((r) => r.id !== id),
      slots: s.slots.filter((x) => x.roomId !== id),
    });
  const removeBlock = (id: string) =>
    (!s.slots.some((x) => x.blockId === id) ||
      confirm("Remove this block and unschedule its teams?")) &&
    setS({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== id),
      slots: s.slots.filter((x) => x.blockId !== id),
      activeBlockId: s.activeBlockId === id ? undefined : s.activeBlockId,
    });
  const toggleJudge = (roomId: string, judgeId: string) =>
    setS({
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

  if (!loaded) return <Status loading={!error} error={error} onRetry={load} />;

  return (
    <fieldset
      disabled={busy}
      data-unsaved={dirty}
      className="max-w-7xl space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Schedule
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Place teams and judges, then save to publish their schedules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/schedule/board"
            target="_blank"
            rel="noreferrer"
            className={btn}
          >
            Open display ↗
          </a>
          {dirty && (
            <span className="text-xs text-amber-300">Unsaved changes</span>
          )}
          <button
            className={btn}
            disabled={!dirty || busy}
            onClick={() => {
              if (confirm("Discard unsaved changes and reload?")) load();
            }}
          >
            Discard
          </button>
          <button
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50"
            disabled={!dirty || busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>
      <Status error={error} notice={!dirty ? notice : ""} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Rooms
            </h2>
            <button className={btn} onClick={addRoom}>
              Add room
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {s.rooms.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-white/10 bg-[#0b0b0c] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Room name"
                    className={`${input} min-w-32 flex-1`}
                    value={r.name}
                    onChange={(e) =>
                      setS({
                        ...s,
                        rooms: s.rooms.map((x) =>
                          x.id === r.id ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <input
                    className={`${input} min-w-32 flex-1`}
                    aria-label={`Usher for ${r.name}`}
                    placeholder="Usher"
                    value={r.usher ?? ""}
                    onChange={(e) =>
                      setS({
                        ...s,
                        rooms: s.rooms.map((x) =>
                          x.id === r.id
                            ? { ...x, usher: e.target.value || undefined }
                            : x,
                        ),
                      })
                    }
                  />
                  <button className={chipBtn} onClick={() => removeRoom(r.id)}>
                    Remove
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {judges.map((j) => {
                    const on = r.judgeIds.includes(j.id);
                    return (
                      <button
                        key={j.id}
                        aria-pressed={on}
                        onClick={() => toggleJudge(r.id, j.id)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-cyan-300/30 bg-cyan-300/10 text-slate-50" : "border-white/10 text-slate-400"}`}
                      >
                        {j.name}
                      </button>
                    );
                  })}
                  {judges.length === 0 && (
                    <span className="text-xs text-slate-500">
                      No judges yet.
                    </span>
                  )}
                </div>
              </div>
            ))}
            {s.rooms.length === 0 && (
              <p className="text-sm text-slate-500">
                Add a room and put judges in it.
              </p>
            )}
          </div>
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Blocks
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Minutes per block</span>
              <input
                aria-label="Minutes per block"
                type="number"
                min={1}
                className={`${input} w-16`}
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <button className={btn} onClick={addBlock}>
                Add block
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {s.blocks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2">
                <button
                  aria-pressed={s.activeBlockId === b.id}
                  title={
                    s.activeBlockId === b.id
                      ? "Active now. Click to clear."
                      : "Mark as the active block"
                  }
                  onClick={() =>
                    setS({
                      ...s,
                      activeBlockId:
                        s.activeBlockId === b.id ? undefined : b.id,
                    })
                  }
                  className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold ${s.activeBlockId === b.id ? "border-cyan-300/30 bg-cyan-300/10 text-slate-50" : "border-white/10 text-slate-500 hover:text-slate-200"}`}
                >
                  {s.activeBlockId === b.id ? "Active on save" : "Set active"}
                </button>
                <input
                  aria-label="Block label"
                  className={`${input} min-w-32 flex-1`}
                  value={b.label}
                  onChange={(e) =>
                    setS({
                      ...s,
                      blocks: s.blocks.map((x) =>
                        x.id === b.id ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`Start time for ${b.label}`}
                  type="time"
                  className={input}
                  value={b.startsAt}
                  onChange={(e) =>
                    setS({
                      ...s,
                      blocks: s.blocks.map((x) =>
                        x.id === b.id ? { ...x, startsAt: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button className={chipBtn} onClick={() => removeBlock(b.id)}>
                  Remove
                </button>
              </div>
            ))}
            {s.blocks.length === 0 && (
              <p className="text-sm text-slate-500">
                Add blocks, or auto-fill below to create them as needed.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            Grid
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">
              Drag teams, or choose their slot below.
            </span>
            <button
              className={btn}
              disabled={!s.rooms.length || !free.length}
              onClick={() => setS(autoFill(s, teams, minutes))}
            >
              Auto-fill
            </button>
          </div>
        </div>
        <div
          className={`mt-3 flex min-h-12 flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-white/15 p-2 ${dropRing("tray")}`}
          {...dropProps("tray", (id) => setS(unplace(s, id)))}
        >
          <span className="mr-1 text-xs uppercase tracking-[0.12em] text-slate-500">
            Unscheduled · {free.length}
          </span>
          {free.map((t) => (
            <span
              key={t.id}
              {...dragProps(t.id)}
              className={`cursor-grab rounded-full border border-white/10 bg-[#0b0b0c] px-2.5 py-1 text-xs text-slate-100 active:cursor-grabbing ${dragging === t.id ? "opacity-40" : ""}`}
            >
              {t.name}
            </span>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-transparent px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Block
                </th>
                {s.rooms.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-left align-top">
                    <div className="font-semibold text-slate-50">{r.name}</div>
                    <div className="text-xs font-normal text-slate-400">
                      {r.judgeIds.map(judgeName).join(", ") || "no judges"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.blocks.map((b) => (
                <tr key={b.id} className="border-t border-white/10">
                  <td
                    className={`sticky left-0 px-3 py-2 align-top ${s.activeBlockId === b.id ? "bg-cyan-300/10" : ""}`}
                  >
                    <div className="font-semibold text-slate-50">{b.label}</div>
                    <div className="text-xs text-slate-400">{b.startsAt}</div>
                  </td>
                  {s.rooms.map((r) => (
                    <td
                      key={r.id}
                      className={`min-w-52 border-l border-white/[0.08] px-3 py-2 align-top ${dropRing(`${b.id}|${r.id}`)}`}
                      {...dropProps(`${b.id}|${r.id}`, (id) =>
                        setS(place(s, id, b.id, r.id)),
                      )}
                    >
                      <div className="min-h-10 space-y-1.5">
                        {slotAt(s, b.id, r.id).map((x) => (
                          <div
                            key={x.teamId}
                            {...dragProps(x.teamId)}
                            className={`cursor-grab rounded-lg border border-white/10 bg-[#0b0b0c] px-2.5 py-1.5 active:cursor-grabbing ${dragging === x.teamId ? "opacity-40" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="truncate text-sm text-slate-100">
                                {teamName(x.teamId)}
                              </span>
                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  className={chipBtn}
                                  title="Push to the next block in this room"
                                  onClick={() =>
                                    setS(delay(s, x.teamId, minutes))
                                  }
                                >
                                  Delay
                                </button>
                                <button
                                  className={chipBtn}
                                  aria-label={`Unschedule ${teamName(x.teamId)}`}
                                  title="Unschedule"
                                  onClick={() => setS(unplace(s, x.teamId))}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {(s.blocks.length === 0 || s.rooms.length === 0) && (
                <tr>
                  <td
                    className="px-3 py-4 text-sm text-slate-500"
                    colSpan={s.rooms.length + 1}
                  >
                    Add at least one room and one block.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Team placement</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {teams.map((t) => {
            const slot = s.slots.find((x) => x.teamId === t.id);
            return (
              <label key={t.id} className="ux-label">
                {t.name}
                <select
                  className="ux-input"
                  value={slot ? `${slot.blockId}|${slot.roomId}` : ""}
                  onChange={(e) => {
                    const [block, room] = e.target.value.split("|");
                    setS(
                      block && room
                        ? place(s, t.id, block, room)
                        : unplace(s, t.id),
                    );
                  }}
                >
                  <option value="">Unscheduled</option>
                  {s.blocks.flatMap((b) =>
                    s.rooms.map((r) => (
                      <option key={`${b.id}|${r.id}`} value={`${b.id}|${r.id}`}>
                        {b.label} · {r.name}
                      </option>
                    )),
                  )}
                </select>
              </label>
            );
          })}
        </div>
      </section>
      <details className={card}>
        <summary className="font-semibold">Recent changes</summary>
        <ul className="mt-3 space-y-1 text-sm">
          {saved.changes.slice(0, 40).map((c, i) => (
            <li key={i} className="flex flex-wrap gap-3 text-slate-300">
              <span className="shrink-0 font-mono text-xs text-slate-500">
                {new Date(c.at).toLocaleString()}
              </span>
              <span>{c.message}</span>
              {c.by && (
                <span className="ml-auto shrink-0 text-xs text-slate-500">
                  {c.by}
                </span>
              )}
            </li>
          ))}
          {saved.changes.length === 0 && (
            <li className="text-slate-500">
              Nothing yet. Every save logs what moved.
            </li>
          )}
        </ul>
      </details>
    </fieldset>
  );
}
