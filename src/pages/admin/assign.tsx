"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, errorMessage } from "@/lib/bt";
import { getSession } from "@/lib/session";
import { EMPTY_SCHEDULE, assignmentsFrom, describeChanges, isExcluded, toggleExclusion, withChanges, type Schedule } from "@/lib/schedule";

export default dynamic(() => Promise.resolve(() => (
  <RoleGate allow={["admin"]}>
    <Layout>
      <Page />
    </Layout>
  </RoleGate>
)), { ssr: false });

const card = "rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
const btn = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50";

function Page() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [saved, setSaved] = useState<Schedule>(EMPTY_SCHEDULE);
  const [s, setS] = useState<Schedule>(EMPTY_SCHEDULE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
  const blockOrder = useMemo(() => new Map(s.blocks.map((b, i) => [b.id, i])), [s.blocks]);
  const excluded = s.exclusions?.length ?? 0;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const withNames = (msgs: string[]) => msgs.map((m) => m.replace(/^Judge (\S+)/, (_, id: string) => `Judge ${judgeName(id)}`));
      const next = withChanges(s, withNames(describeChanges(saved, s, teams)), getSession()?.id);
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

  if (s.rooms.length === 0 || s.slots.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Assignments</h1>
        <div className={`${card} mt-6`}>
          <p className="text-sm text-slate-300">Assignments come from rooms: the judges in a room judge every team scheduled into it. This page only records exceptions, and there is nothing scheduled yet.</p>
          <Link href="/admin/schedule" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200">Open schedule</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Assignments</h1>
          <p className="mt-1 text-sm text-slate-400">Exceptions only. Untick a box to excuse a judge from a team; the room and the schedule stay as they are. {excluded ? `${excluded} exclusion${excluded === 1 ? "" : "s"}.` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-300">Unsaved</span>}
          <button className={btn} disabled={!dirty || busy} onClick={() => setS(saved)}>Discard</button>
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-rose-300">{error}</div>}

      {s.rooms.map((r) => {
        const rows = s.slots
          .filter((x) => x.roomId === r.id)
          .sort((a, b) => (blockOrder.get(a.blockId) ?? 0) - (blockOrder.get(b.blockId) ?? 0));
        return (
          <section key={r.id} className={card}>
            <h2 className="text-lg font-semibold text-slate-50">{r.name}</h2>
            {r.judgeIds.length === 0 ? (
              <p className="mt-2 text-sm text-amber-300">No judges in this room.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Block</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Team</th>
                      {r.judgeIds.map((jid) => (
                        <th key={jid} className="px-3 py-2 text-left align-top">
                          <div className="font-semibold text-slate-50">{judgeName(jid)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.teamId} className="border-t border-white/[0.08]">
                        <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500">{s.blocks.find((b) => b.id === x.blockId)?.label}</td>
                        <td className="px-3 py-2 text-slate-100">{teamName(x.teamId)}</td>
                        {r.judgeIds.map((jid) => (
                          <td key={jid} className="px-3 py-2">
                            <input type="checkbox" className="size-4 accent-[#2b7fff]" checked={!isExcluded(s, jid, x.teamId)} onChange={() => setS(toggleExclusion(s, jid, x.teamId))} title={isExcluded(s, jid, x.teamId) ? "Excused. Tick to restore." : "Judging. Untick to excuse."} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td className="px-3 py-3 text-slate-500" colSpan={2 + r.judgeIds.length}>No teams in this room.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
