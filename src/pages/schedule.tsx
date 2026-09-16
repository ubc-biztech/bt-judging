"use client";

import TableScroll from "@/components/TableScroll";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Status } from "@/components/Feedback";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { errorMessage, eventOrEmpty } from "@/lib/bt";
import { EMPTY_SCHEDULE, isExcluded, slotAt, slotOf } from "@/lib/schedule";

export default dynamic(
  () =>
    Promise.resolve(() => (
      <RoleGate allow={["admin", "judge", "team"]}>
        <Layout>
          <Page />
        </Layout>
      </RoleGate>
    )),
  { ssr: false },
);

function Page() {
  const { session } = useClientSession();
  const {
    data: doc,
    error,
    refresh,
  } = usePoll(eventOrEmpty, [session?.role, session?.id], 10000);
  const s = doc?.settings.schedule ?? EMPTY_SCHEDULE;
  const teamName = (id: string) =>
    session?.role === "judge" && doc?.settings.anonymizeTeams
      ? `Team ${id.slice(0, 4).toUpperCase()}`
      : (doc?.teams.find((t) => t.id === id)?.name ?? id);
  const judgeName = (id: string) =>
    doc?.judges.find((j) => j.id === id)?.name ?? id;
  const mine = (roomId: string, teamId: string) =>
    (session?.role === "judge" &&
      !isExcluded(s, session.id, teamId) &&
      s.rooms.find((r) => r.id === roomId)?.judgeIds.includes(session.id)) ||
    (session?.role === "team" && teamId === session.id);
  const mySlot = session?.role === "team" ? slotOf(s, session.id) : undefined;
  const myRooms =
    session?.role === "judge"
      ? s.rooms.filter((room) => room.judgeIds.includes(session.id))
      : [];
  const assigned =
    doc?.judges.find((judge) => judge.id === session?.id)?.assignedTeamIds ??
    [];

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Schedule
      </h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {doc?.settings.phase === "finals"
            ? "Preliminary presentation schedule. Finals assignments are in the finals queue."
            : session?.role === "admin"
              ? "Published schedule"
              : "Live schedule · Your slots are highlighted."}
        </p>
        <a
          href="/schedule/board"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08]"
        >
          Open display ↗
        </a>
      </div>
      <Status
        loading={!doc && !error}
        error={error ? errorMessage(error) : ""}
        onRetry={refresh}
      />
      {doc && !error && session?.role === "judge" && (
        <p className="mt-5 rounded-lg border border-[var(--line)] p-4 text-sm">
          {myRooms.length ? (
            <>
              Your {myRooms.length === 1 ? "room" : "rooms"}:{" "}
              <strong>{myRooms.map((room) => room.name).join(", ")}</strong>
            </>
          ) : (
            "No room assigned yet. Check with an organizer."
          )}
        </p>
      )}
      {doc && !error && session?.role === "team" && (
        <p className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm">
          {mySlot ? (
            <>
              Your presentation:{" "}
              <strong>
                {s.blocks.find((b) => b.id === mySlot.blockId)?.startsAt} ·{" "}
                {s.rooms.find((r) => r.id === mySlot.roomId)?.name}
              </strong>
            </>
          ) : (
            "Your team does not have a time slot yet. Check with an organizer."
          )}
        </p>
      )}
      <TableScroll
        label="Published schedule"
        className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-2"
      >
        <table className="min-w-full [&_th]:min-w-40 border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Block
              </th>
              {s.rooms.map((r) => (
                <th key={r.id} className="px-4 py-3 text-left align-top">
                  <div className="font-semibold text-slate-50">{r.name}</div>
                  <div className="text-xs font-normal text-slate-400">
                    {r.judgeIds.map(judgeName).join(", ")}
                  </div>
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
                  <td
                    key={r.id}
                    className="border-t border-l border-white/[0.08] px-4 py-3 align-top"
                  >
                    {slotAt(s, b.id, r.id).map((x) => (
                      <div
                        key={x.teamId}
                        className={`rounded-lg px-2.5 py-1.5 text-sm ${mine(r.id, x.teamId) ? "border border-cyan-300/30 bg-cyan-300/10 text-slate-50" : "text-slate-200"}`}
                      >
                        {session?.role === "judge" &&
                        doc?.settings.phase === "prelim" &&
                        assigned.includes(x.teamId) &&
                        mine(r.id, x.teamId) ? (
                          <Link
                            className="underline underline-offset-4"
                            href={`/judge/${x.teamId}`}
                          >
                            {teamName(x.teamId)} · Score →
                          </Link>
                        ) : (
                          teamName(x.teamId)
                        )}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
            {doc &&
              !error &&
              (s.blocks.length === 0 || s.rooms.length === 0) && (
                <tr>
                  <td
                    className="px-4 py-6 text-sm text-slate-500"
                    colSpan={s.rooms.length + 1}
                  >
                    The organizers have not published a schedule yet.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
