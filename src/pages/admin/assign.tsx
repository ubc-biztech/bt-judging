"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, errorMessage } from "@/lib/bt";
import { getSession } from "@/lib/session";
import { EMPTY_SCHEDULE, assignmentsFrom, autoFill, describeChanges, placeInRoom, slotOf, unplace, unscheduled, withChanges, type Schedule } from "@/lib/schedule";

export default dynamic(() => Promise.resolve(() => (
  <RoleGate allow={["admin"]}>
    <Layout>
      <Page />
    </Layout>
  </RoleGate>
)), { ssr: false });

const card = "rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
const select = "rounded-md border border-white/10 bg-[#0b0b0c] px-2 py-1 text-xs text-slate-100";
const btn = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50";

function Page() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [saved, setSaved] = useState<Schedule>(EMPTY_SCHEDULE);
  const [s, setS] = useState<Schedule>(EMPTY_SCHEDULE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const judgeName = (id: string) => judges.find((j) => j.id === id)?.name ?? id;
  const blockLabel = (id: string) => s.blocks.find((b) => b.id === id)?.label ?? "";
  const blockOrder = useMemo(() => new Map(s.blocks.map((b, i) => [b.id, i])), [s.blocks]);
  const free = unscheduled(s, teams);
  const matches = (t: Team) => !search || t.name.toLowerCase().includes(search.toLowerCase());
  const roomTeams = (roomId: string) =>
    s.slots
      .filter((x) => x.roomId === roomId)
      .sort((a, b) => (blockOrder.get(a.blockId) ?? 0) - (blockOrder.get(b.blockId) ?? 0))
      .map((x) => ({ slot: x, team: teamById.get(x.teamId) }))
      .filter((x): x is { slot: typeof x.slot; team: Team } => !!x.team && matches(x.team));

  async function save() {
    setBusy(true);
    setError("");
    try {
      const next = withChanges(s, describeChanges(saved, s, teams), getSession()?.id);
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

  if (s.rooms.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Assignments</h1>
        <div className={`${card} mt-6`}>
          <p className="text-sm text-slate-300">Assignments follow rooms: the judges in a room judge every team scheduled into it. There are no rooms yet.</p>
          <Link href="/admin/schedule" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200">Set up rooms</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Assignments</h1>
          <p className="mt-1 text-sm text-slate-400">By room. Judges are set on <Link href="/admin/schedule" className="underline">Schedule</Link>; moving a team here keeps its block where possible.</p>
        </div>
        <div className="flex items-center gap-2">
          <input className={`${select} h-8 w-44`} placeholder="Search teams" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={btn} disabled={!free.length} onClick={() => setS(autoFill(s, teams))}>Auto-assign {free.length ? `(${free.length})` : ""}</button>
          {dirty && <span className="text-xs text-amber-300">Unsaved</span>}
          <button className={btn} disabled={!dirty || busy} onClick={() => setS(saved)}>Discard</button>
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-rose-300">{error}</div>}

      {free.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Unassigned · {free.length}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {free.filter(matches).map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b0b0c] px-2.5 py-1.5">
                <span className="text-sm text-slate-100">{t.name}</span>
                <select className={select} value="" onChange={(e) => e.target.value && setS(placeInRoom(s, t.id, e.target.value))}>
                  <option value="">Assign to…</option>
                  {s.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.rooms.map((r) => {
          const rows = roomTeams(r.id);
          const count = s.slots.filter((x) => x.roomId === r.id).length;
          return (
            <section key={r.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">{r.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{r.judgeIds.length ? r.judgeIds.map(judgeName).join(", ") : "No judges"}{r.usher ? ` · usher ${r.usher}` : ""}</p>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-xs ${r.judgeIds.length ? "bg-white/[0.06] text-slate-200" : "bg-amber-500/10 text-amber-300"}`}>{count} team{count === 1 ? "" : "s"}</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {rows.map(({ slot, team }) => (
                  <li key={team.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b0b0c] px-2.5 py-1.5">
                    <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-slate-500">{blockLabel(slot.blockId)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{team.name}</span>
                    <select className={select} value={r.id} onChange={(e) => setS(placeInRoom(s, team.id, e.target.value))} title="Move to another room">
                      {s.rooms.map((rr) => <option key={rr.id} value={rr.id}>{rr.name}</option>)}
                    </select>
                    <button className="rounded px-1.5 text-slate-400 hover:text-slate-100" title="Unassign" onClick={() => setS(unplace(s, team.id))}>×</button>
                  </li>
                ))}
                {rows.length === 0 && <li className="text-sm text-slate-500">{search ? "No matches." : "No teams yet."}</li>}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        {s.slots.length} of {teams.length} teams assigned · {s.rooms.filter((r) => !r.judgeIds.length).length} room{s.rooms.filter((r) => !r.judgeIds.length).length === 1 ? "" : "s"} without judges
        {teams.some((t) => slotOf(s, t.id) && !s.rooms.find((r) => r.id === slotOf(s, t.id)!.roomId)?.judgeIds.length) ? " · some teams sit in a room with no judges" : ""}
      </p>
    </div>
  );
}
