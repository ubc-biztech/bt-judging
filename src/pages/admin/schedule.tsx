"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, errorMessage } from "@/lib/bt";
import { EMPTY_SCHEDULE, addMinutes, assignmentsFrom, autoFill, delay, describeChanges, newId, place, slotAt, unplace, unscheduled, withChanges, type Schedule } from "@/lib/schedule";

export default dynamic(() => Promise.resolve(() => (
  <RoleGate allow={["admin"]}>
    <Layout>
      <Page />
    </Layout>
  </RoleGate>
)), { ssr: false });

const card = "rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
const input = "rounded-md border border-white/10 bg-[#0b0b0c] px-2 py-1 text-sm text-slate-100";
const btn = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50";
const chipBtn = "rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100";

function Page() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [saved, setSaved] = useState<Schedule>(EMPTY_SCHEDULE);
  const [s, setS] = useState<Schedule>(EMPTY_SCHEDULE);
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState<string | null>(null);

  useEffect(() => {
    eventOrEmpty()
      .then((doc) => {
        setTeams(doc.teams);
        setJudges(doc.judges);
        const sched = doc.settings.schedule ?? EMPTY_SCHEDULE;
        setSaved(sched);
        setS(sched);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const dirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(saved), [s, saved]);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
  const judgeName = (id: string) => judges.find((j) => j.id === id)?.name ?? id;
  const free = unscheduled(s, teams);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const next = withChanges(s, describeChanges(saved, s, teams));
      const doc = await saveEvent((d) => ({ ...d, settings: { ...d.settings, schedule: next }, judges: assignmentsFrom(next, d.judges) }));
      const stored = doc.settings.schedule ?? EMPTY_SCHEDULE;
      setSaved(stored);
      setS(stored);
      setJudges(doc.judges);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  const addRoom = () => setS({ ...s, rooms: [...s.rooms, { id: newId("room"), name: `Room ${String.fromCharCode(65 + s.rooms.length)}`, judgeIds: [] }] });
  const addBlock = () => {
    const last = s.blocks[s.blocks.length - 1];
    setS({ ...s, blocks: [...s.blocks, { id: newId("blk"), label: `Block ${s.blocks.length + 1}`, startsAt: last ? addMinutes(last.startsAt, minutes) : "09:00" }] });
  };
  const removeRoom = (id: string) => setS({ ...s, rooms: s.rooms.filter((r) => r.id !== id), slots: s.slots.filter((x) => x.roomId !== id) });
  const removeBlock = (id: string) => setS({ ...s, blocks: s.blocks.filter((b) => b.id !== id), slots: s.slots.filter((x) => x.blockId !== id) });
  const toggleJudge = (roomId: string, judgeId: string) =>
    setS({ ...s, rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, judgeIds: r.judgeIds.includes(judgeId) ? r.judgeIds.filter((j) => j !== judgeId) : [...r.judgeIds, judgeId] } : r)) });

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Schedule</h1>
          <p className="mt-1 text-sm text-slate-400">Rooms stay put; blocks are times; every room judges at the same time. Saving rewrites each judge&apos;s assigned teams from their room.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
          <button className={btn} disabled={!dirty || busy} onClick={() => setS(saved)}>Discard</button>
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-rose-300">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Rooms</h2>
            <button className={btn} onClick={addRoom}>Add room</button>
          </div>
          <div className="mt-3 space-y-3">
            {s.rooms.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-[#0b0b0c] p-3">
                <div className="flex items-center gap-2">
                  <input className={`${input} flex-1`} value={r.name} onChange={(e) => setS({ ...s, rooms: s.rooms.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) })} />
                  <button className={chipBtn} onClick={() => removeRoom(r.id)}>Remove</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {judges.map((j) => {
                    const on = r.judgeIds.includes(j.id);
                    return (
                      <button key={j.id} onClick={() => toggleJudge(r.id, j.id)} className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-cyan-300/30 bg-cyan-300/10 text-slate-50" : "border-white/10 text-slate-400"}`}>
                        {j.name}
                      </button>
                    );
                  })}
                  {judges.length === 0 && <span className="text-xs text-slate-500">No judges yet.</span>}
                </div>
              </div>
            ))}
            {s.rooms.length === 0 && <p className="text-sm text-slate-500">Add a room and put judges in it.</p>}
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Blocks</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Minutes per block</span>
              <input type="number" min={1} className={`${input} w-16`} value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))} />
              <button className={btn} onClick={addBlock}>Add block</button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {s.blocks.map((b) => (
              <div key={b.id} className="flex items-center gap-2">
                <input className={`${input} flex-1`} value={b.label} onChange={(e) => setS({ ...s, blocks: s.blocks.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })} />
                <input type="time" className={input} value={b.startsAt} onChange={(e) => setS({ ...s, blocks: s.blocks.map((x) => (x.id === b.id ? { ...x, startsAt: e.target.value } : x)) })} />
                <button className={chipBtn} onClick={() => removeBlock(b.id)}>Remove</button>
              </div>
            ))}
            {s.blocks.length === 0 && <p className="text-sm text-slate-500">Add blocks, or auto-fill below to create them as needed.</p>}
          </div>
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Grid</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{free.length} unscheduled</span>
            <button className={btn} disabled={!s.rooms.length || !free.length} onClick={() => setS(autoFill(s, teams, minutes))}>Auto-fill</button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-transparent px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Block</th>
                {s.rooms.map((r) => (
                  <th key={r.id} className="px-3 py-2 text-left align-top">
                    <div className="font-semibold text-slate-50">{r.name}</div>
                    <div className="text-xs font-normal text-slate-400">{r.judgeIds.map(judgeName).join(", ") || "no judges"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.blocks.map((b) => (
                <tr key={b.id} className="border-t border-white/10">
                  <td className="sticky left-0 px-3 py-2 align-top">
                    <div className="font-semibold text-slate-50">{b.label}</div>
                    <div className="text-xs text-slate-400">{b.startsAt}</div>
                  </td>
                  {s.rooms.map((r) => (
                    <td key={r.id} className="min-w-52 border-l border-white/[0.08] px-3 py-2 align-top">
                      <div className="space-y-1.5">
                        {slotAt(s, b.id, r.id).map((x) => (
                          <div key={x.teamId} className="rounded-lg border border-white/10 bg-[#0b0b0c] px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm text-slate-100">{teamName(x.teamId)}</span>
                              <div className="flex shrink-0 gap-0.5">
                                <button className={chipBtn} title="Push to the next block in this room" onClick={() => setS(delay(s, x.teamId, minutes))}>Delay</button>
                                <button className={chipBtn} onClick={() => setMoving(moving === x.teamId ? null : x.teamId)}>Move</button>
                                <button className={chipBtn} onClick={() => setS(unplace(s, x.teamId))}>×</button>
                              </div>
                            </div>
                            {moving === x.teamId && (
                              <div className="mt-1.5 flex gap-1">
                                <select className={`${input} flex-1`} defaultValue={b.id} id={`mb-${x.teamId}`}>
                                  {s.blocks.map((bb) => <option key={bb.id} value={bb.id}>{bb.label} · {bb.startsAt}</option>)}
                                </select>
                                <select className={`${input} flex-1`} defaultValue={r.id} id={`mr-${x.teamId}`}>
                                  {s.rooms.map((rr) => <option key={rr.id} value={rr.id}>{rr.name}</option>)}
                                </select>
                                <button className={btn} onClick={() => {
                                  const bid = (document.getElementById(`mb-${x.teamId}`) as HTMLSelectElement).value;
                                  const rid = (document.getElementById(`mr-${x.teamId}`) as HTMLSelectElement).value;
                                  setS(place(s, x.teamId, bid, rid));
                                  setMoving(null);
                                }}>Go</button>
                              </div>
                            )}
                          </div>
                        ))}
                        {free.length > 0 && (
                          <select className={`${input} w-full text-xs`} value="" onChange={(e) => e.target.value && setS(place(s, e.target.value, b.id, r.id))}>
                            <option value="">Add team…</option>
                            {free.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              {(s.blocks.length === 0 || s.rooms.length === 0) && (
                <tr><td className="px-3 py-4 text-sm text-slate-500" colSpan={s.rooms.length + 1}>Add at least one room and one block.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Changes</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {saved.changes.slice(0, 40).map((c, i) => (
            <li key={i} className="flex gap-3 text-slate-300">
              <span className="shrink-0 font-mono text-xs text-slate-500">{new Date(c.at).toLocaleString()}</span>
              <span>{c.message}</span>
            </li>
          ))}
          {saved.changes.length === 0 && <li className="text-slate-500">Nothing yet. Every save logs what moved.</li>}
        </ul>
      </section>
    </div>
  );
}
