"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import type { JudgingEvent } from "@ubc-biztech/sdk";
import { eventOrEmpty } from "@/lib/bt";
import { EMPTY_SCHEDULE, slotAt } from "@/lib/schedule";

export default dynamic(() => Promise.resolve(() => (
  <RoleGate allow={["admin", "judge", "team"]}>
    <Board />
  </RoleGate>
)), { ssr: false });

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function Board() {
  const [doc, setDoc] = useState<JudgingEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setBusy(true);
    eventOrEmpty().then(setDoc).finally(() => setBusy(false));
  };
  useEffect(load, []);
  const [now, setNow] = useState(hhmm(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(hhmm(new Date())), 30000);
    return () => clearInterval(id);
  }, []);
  const s = doc?.settings.schedule ?? EMPTY_SCHEDULE;
  const teamName = (id: string) => doc?.teams.find((t) => t.id === id)?.name ?? id;
  const judgeName = (id: string) => doc?.judges.find((j) => j.id === id)?.name ?? id;
  const current = s.activeBlockId;

  return (
    <div className="min-h-dvh bg-[#050505] px-8 py-8 text-slate-100">
      <div className="flex items-end justify-between gap-6">
        <div>
          <img src="/hh.svg" alt="HelloHacks" className="h-12 w-auto" />
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">Judging Schedule</h1>
        </div>
        <div className="text-right text-sm text-slate-400">
          <div className="text-3xl font-semibold tabular-nums text-slate-50">{now}</div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-lg">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#050505] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Room</th>
              {s.blocks.map((b) => (
                <th key={b.id} className={`min-w-56 px-4 py-3 text-left align-bottom ${b.id === current ? "rounded-t-xl bg-cyan-300/10" : ""}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{b.label}</div>
                  <div className={`text-2xl font-semibold tabular-nums ${b.id === current ? "text-cyan-200" : "text-slate-50"}`}>{b.startsAt}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rooms.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 border-t border-white/10 bg-[#050505] px-4 py-4 align-top">
                  <div className="text-xl font-semibold text-slate-50">{r.name}</div>
                </td>
                {s.blocks.map((b) => (
                  <td key={b.id} className={`border-t border-l border-white/[0.08] px-4 py-4 align-top ${b.id === current ? "bg-cyan-300/10" : ""}`}>
                    {slotAt(s, b.id, r.id).map((x) => (
                      <div key={x.teamId} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xl font-medium text-slate-50">
                        {teamName(x.teamId)}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
            {(s.rooms.length === 0 || s.blocks.length === 0) && (
              <tr><td className="px-4 py-8 text-lg text-slate-500" colSpan={s.blocks.length + 1}>No schedule published yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={load}
        disabled={busy}
        aria-label="Refresh"
        className="fixed bottom-4 left-4 text-xs text-slate-200/60 transition hover:text-slate-50 disabled:opacity-40"
      >
        {busy ? "refreshing…" : "refresh"}
      </button>
    </div>
  );
}
