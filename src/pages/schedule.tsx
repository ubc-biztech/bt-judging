"use client";

import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { eventOrEmpty } from "@/lib/bt";
import { EMPTY_SCHEDULE, slotAt } from "@/lib/schedule";

export default dynamic(() => Promise.resolve(() => (
  <RoleGate allow={["admin", "judge", "team"]}>
    <Layout>
      <Page />
    </Layout>
  </RoleGate>
)), { ssr: false });

function Page() {
  const { session } = useClientSession();
  const { data: doc } = usePoll(eventOrEmpty, [session?.role, session?.id], 10000);
  const s = doc?.settings.schedule ?? EMPTY_SCHEDULE;
  const teamName = (id: string) => doc?.teams.find((t) => t.id === id)?.name ?? id;
  const judgeName = (id: string) => doc?.judges.find((j) => j.id === id)?.name ?? id;
  const mine = (roomId: string, teamId: string) =>
    (session?.role === "judge" && s.rooms.find((r) => r.id === roomId)?.judgeIds.includes(session.id)) || (session?.role === "team" && teamId === session.id);

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Schedule</h1>
      <p className="mt-1 text-sm text-slate-400">Live. Refreshes every 10 seconds; your own slots are highlighted.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Block</th>
              {s.rooms.map((r) => (
                <th key={r.id} className="px-4 py-3 text-left align-top">
                  <div className="font-semibold text-slate-50">{r.name}</div>
                  <div className="text-xs font-normal text-slate-400">{r.judgeIds.map(judgeName).join(", ")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.blocks.map((b) => (
              <tr key={b.id}>
                <td className="border-t border-white/10 px-4 py-3 align-top">
                  <div className="font-semibold text-slate-50">{b.label}</div>
                  <div className="text-xs text-slate-400">{b.startsAt}</div>
                </td>
                {s.rooms.map((r) => (
                  <td key={r.id} className="border-t border-l border-white/[0.08] px-4 py-3 align-top">
                    {slotAt(s, b.id, r.id).map((x) => (
                      <div key={x.teamId} className={`rounded-lg px-2.5 py-1.5 text-sm ${mine(r.id, x.teamId) ? "border border-cyan-300/30 bg-cyan-300/10 text-slate-50" : "text-slate-200"}`}>
                        {teamName(x.teamId)}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
            {s.blocks.length === 0 && (
              <tr><td className="px-4 py-6 text-sm text-slate-500" colSpan={s.rooms.length + 1}>The organizers have not published a schedule yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
