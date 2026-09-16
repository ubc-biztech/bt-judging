"use client";
import EventBrand from "@/components/EventBrand";

import TableScroll from "@/components/TableScroll";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import { Status } from "@/components/Feedback";
import { usePoll } from "@/lib/usePoll";
import { useClientSession } from "@/lib/session";
import { errorMessage, eventOrEmpty } from "@/lib/bt";
import { EMPTY_SCHEDULE, slotAt } from "@/lib/schedule";

export default dynamic(
  () =>
    Promise.resolve(() => (
      <RoleGate allow={["admin", "judge", "team"]}>
        <Board />
      </RoleGate>
    )),
  { ssr: false },
);

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function Board() {
  const { session } = useClientSession();
  const {
    data: doc,
    error,
    loading: busy,
    refresh: load,
  } = usePoll(eventOrEmpty, [session?.role, session?.id], 10000);
  const [now, setNow] = useState(hhmm(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(hhmm(new Date())), 30000);
    return () => clearInterval(id);
  }, []);
  const s = doc?.settings.schedule ?? EMPTY_SCHEDULE;
  const teamName = (id: string) =>
    session?.role === "judge" && doc?.settings.anonymizeTeams
      ? `Team ${id.slice(0, 4).toUpperCase()}`
      : (doc?.teams.find((t) => t.id === id)?.name ?? id);
  const firstNames = (id: string) =>
    session?.role === "judge" && doc?.settings.anonymizeTeams
      ? ""
      : (doc?.teams.find((t) => t.id === id)?.members ?? [])
          .map((m) => m.trim().split(/\s+/)[0])
          .filter(Boolean)
          .join(", ");
  const current = s.activeBlockId;

  return (
    <div className="min-h-dvh bg-[#050505] px-8 py-8 text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {doc && (
            <EventBrand
              name={doc.settings.eventName}
              imageUrl={doc.settings.imageUrl}
            />
          )}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">
            Judging Schedule
          </h1>
        </div>
        <div className="text-right text-sm text-slate-400">
          <div className="text-3xl font-semibold tabular-nums text-slate-50">
            {now}
          </div>
        </div>
      </div>

      <Status
        loading={!doc && !error}
        error={error ? errorMessage(error) : ""}
        onRetry={load}
      />
      <TableScroll label="Live schedule" className="mt-8">
        <table className="min-w-full border-separate border-spacing-0 text-lg">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#050505] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Room
              </th>
              {s.blocks.map((b) => (
                <th
                  key={b.id}
                  className={`min-w-56 px-4 py-3 text-left align-bottom ${b.id === current ? "rounded-t-xl bg-cyan-300/10" : ""}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {b.label}
                  </div>
                  <div
                    className={`text-2xl font-semibold tabular-nums ${b.id === current ? "text-cyan-200" : "text-slate-50"}`}
                  >
                    {b.startsAt}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rooms.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 border-t border-white/10 bg-[#050505] px-4 py-4 align-top">
                  <div className="text-xl font-semibold text-slate-50">
                    {r.name}
                  </div>
                  {r.usher && (
                    <div className="mt-1 max-w-48 text-sm text-slate-400">
                      Your Usher: {r.usher}
                    </div>
                  )}
                </td>
                {s.blocks.map((b) => (
                  <td
                    key={b.id}
                    className={`border-t border-l border-white/[0.08] px-4 py-4 align-top ${b.id === current ? "bg-cyan-300/10" : ""}`}
                  >
                    {slotAt(s, b.id, r.id).map((x) => (
                      <div
                        key={x.teamId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="text-xl font-medium text-slate-50">
                          {teamName(x.teamId)}
                        </div>
                        {firstNames(x.teamId) && (
                          <div className="mt-0.5 text-sm text-slate-400">
                            {firstNames(x.teamId)}
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
            {doc &&
              !error &&
              (s.rooms.length === 0 || s.blocks.length === 0) && (
                <tr>
                  <td
                    className="px-4 py-8 text-lg text-slate-500"
                    colSpan={s.blocks.length + 1}
                  >
                    No schedule published yet.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </TableScroll>

      {current && (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <span
            className="inline-block size-3 rounded-sm border border-cyan-300/30 bg-cyan-300/10"
            aria-hidden="true"
          />
          <span>CURRENTLY JUDGING</span>
        </div>
      )}

      <button
        onClick={load}
        disabled={busy}
        aria-label="Refresh"
        className="fixed bottom-4 left-4 text-xs text-[#CCCCCC] transition hover:text-slate-50 disabled:opacity-40"
      >
        {busy ? "refreshing…" : "refresh"}
      </button>
    </div>
  );
}
