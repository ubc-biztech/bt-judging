"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import { OFFICIAL_JUDGING_RUBRIC } from "@/lib/judging";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

type EventSettings = {
  name?: string;
  phase?: string;
  requiredJudgeCount?: number;
  finalsTeamIds?: string[];
  finalsJudgeIds?: string[];
};

type JudgeDoc = {
  assignedTeamIds?: string[];
  isAdmin?: boolean;
};

type ReviewDoc = {
  round?: string;
};

type RubricDoc = {
  criteria?: Array<{ id: string }>;
};

type Snapshot = {
  eventName: string;
  phase: string;
  requiredJudgeCount: number;
  teams: number;
  judges: number;
  rubricCriteria: number;
  prelimReviews: number;
  assignedTeams: number;
  underCoveredTeams: number;
  finalists: number;
  finalsJudges: number;
};

type NextAction = {
  href: string;
  label: string;
  detail: string;
};

export default dynamic(() => Promise.resolve(AdminHome), { ssr: false });

function AdminHome() {
  const [data, setData] = useState<Snapshot>({
    eventName: "Event",
    phase: "submission",
    requiredJudgeCount: 3,
    teams: 0,
    judges: 0,
    rubricCriteria: 0,
    prelimReviews: 0,
    assignedTeams: 0,
    underCoveredTeams: 0,
    finalists: 0,
    finalsJudges: 0
  });

  useEffect(() => {
    (async () => {
      const [eventSnap, rubricSnap, teamsSnap, judgesSnap, reviewsSnap] =
        await Promise.all([
          getDoc(doc(db, "events", EVENT_ID)),
          getDoc(doc(db, "events", EVENT_ID, "rubric", "default")),
          getDocs(collection(db, "events", EVENT_ID, "teams")),
          getDocs(collection(db, "events", EVENT_ID, "judges")),
          getDocs(collection(db, "events", EVENT_ID, "reviews"))
        ]);

      const settings = eventSnap.exists() ? (eventSnap.data() as EventSettings) : {};
      const rubric = rubricSnap.exists() ? (rubricSnap.data() as RubricDoc) : {};
      const rubricCriteriaCount =
        rubric.criteria?.length || OFFICIAL_JUDGING_RUBRIC.criteria.length;
      const requiredJudgeCount = Number(settings.requiredJudgeCount ?? 3);

      const coverage: Record<string, number> = {};
      judgesSnap.forEach((judge) => {
        const data = judge.data() as JudgeDoc;
        if (data.isAdmin) return;
        for (const teamId of data.assignedTeamIds || []) {
          coverage[teamId] = (coverage[teamId] || 0) + 1;
        }
      });

      let prelimReviews = 0;
      reviewsSnap.forEach((review) => {
        const data = review.data() as ReviewDoc;
        if (!data.round || data.round === "prelim") prelimReviews += 1;
      });

      let assignedTeams = 0;
      let underCoveredTeams = 0;
      teamsSnap.forEach((team) => {
        const count = coverage[team.id] || 0;
        if (count > 0) assignedTeams += 1;
        if (count < requiredJudgeCount) underCoveredTeams += 1;
      });

      setData({
        eventName: settings.name?.trim() || "Event",
        phase: settings.phase || "submission",
        requiredJudgeCount,
        teams: teamsSnap.size,
        judges: judgesSnap.docs.filter((d) => !(d.data() as JudgeDoc).isAdmin).length,
        rubricCriteria: rubricCriteriaCount,
        prelimReviews,
        assignedTeams,
        underCoveredTeams,
        finalists: settings.finalsTeamIds?.length || 0,
        finalsJudges: settings.finalsJudgeIds?.length || 0
      });
    })();
  }, []);

  const phaseLabel = useMemo(() => {
    if (data.phase === "finals") return "Finals";
    if (data.phase === "judging") return "Prelim";
    if (data.phase === "closed") return "Closed";
    return "Setup";
  }, [data.phase]);

  const nextAction = useMemo<NextAction>(() => {
    if (data.rubricCriteria === 0) {
      return {
        href: "/admin/rubric",
        label: "Set rubric",
        detail: "Add scoring criteria before judges start reviewing."
      };
    }
    if (data.judges === 0) {
      return {
        href: "/admin/judges",
        label: "Add judges",
        detail: "Create judge accounts before assignments."
      };
    }
    if (data.teams === 0) {
      return {
        href: "/admin/teams",
        label: "Add teams",
        detail: "Teams need to exist before they can be assigned or scored."
      };
    }
    if (data.assignedTeams < data.teams || data.underCoveredTeams > 0) {
      return {
        href: "/admin/assign",
        label: "Finish assignments",
        detail: `${data.underCoveredTeams} team${data.underCoveredTeams === 1 ? "" : "s"} still below coverage.`
      };
    }
    if (data.prelimReviews === 0) {
      return {
        href: "/results",
        label: "Watch prelim scoring",
        detail: "Assignments are ready. Judges can begin reviewing."
      };
    }
    if (data.finalists === 0 || data.finalsJudges === 0) {
      return {
        href: "/admin/finals",
        label: "Prepare finals",
        detail: "Choose finalists and finals judges when prelim is complete."
      };
    }
    return {
      href: "/results",
      label: "Review results",
      detail: "Prelim and finals setup are in place."
    };
  }, [data]);

  const readiness = [
    {
      label: "Rubric",
      value:
        data.rubricCriteria > 0
          ? `${data.rubricCriteria} criteria`
          : "Not set",
      href: "/admin/rubric",
      action: data.rubricCriteria > 0 ? "Edit" : "Set up",
      ok: data.rubricCriteria > 0
    },
    {
      label: "Judges",
      value: `${data.judges} added`,
      href: "/admin/judges",
      action: "Manage",
      ok: data.judges > 0
    },
    {
      label: "Teams",
      value: `${data.teams} added`,
      href: "/admin/teams",
      action: "Manage",
      ok: data.teams > 0
    },
    {
      label: "Assignments",
      value:
        data.teams === 0
          ? "Waiting on teams"
          : `${data.assignedTeams}/${data.teams} assigned`,
      href: "/admin/assign",
      action: "Open",
      ok: data.teams > 0 && data.underCoveredTeams === 0
    },
    {
      label: "Finals",
      value: `${data.finalists} teams • ${data.finalsJudges} judges`,
      href: "/admin/finals",
      action: "Open",
      ok: data.finalists > 0 && data.finalsJudges > 0
    }
  ];

  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <div className="max-w-6xl space-y-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {data.eventName}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
                    Admin
                  </h1>
                </div>
                <span className="rounded-lg border border-white/10 bg-[#0b0b0c] px-3 py-2 text-sm text-slate-200">
                  {phaseLabel}
                </span>
              </div>

              <div className="mt-6 rounded-lg border border-white/10 bg-[#0b0b0c] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Next
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-50">
                      {nextAction.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {nextAction.detail}
                    </p>
                  </div>
                  <Link
                    href={nextAction.href}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-slate-200"
                  >
                    Open
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <FlowCard
                  title="Prelim"
                  value={`${data.prelimReviews} reviews`}
                  hint={`${data.underCoveredTeams} under-covered teams`}
                />
                <FlowCard
                  title="Finals"
                  value={`${data.finalists} finalists`}
                  hint={`${data.finalsJudges} finals judges`}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Event
                </p>
                <Link
                  href="/admin/settings"
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08]"
                >
                  Edit
                </Link>
              </div>
              <div className="mt-4 space-y-4">
                <StatusRow label="Judges per team" value={String(data.requiredJudgeCount)} />
                <StatusRow label="Assigned teams" value={`${data.assignedTeams}/${data.teams}`} />
                <StatusRow
                  label="Coverage gaps"
                  value={String(data.underCoveredTeams)}
                  tone={data.underCoveredTeams > 0 ? "warn" : "default"}
                />
                <StatusRow label="Prelim reviews" value={String(data.prelimReviews)} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="border-b border-white/[0.08] px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-50">Readiness</h2>
            </div>
            <div className="divide-y divide-white/[0.08]">
              {readiness.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.value}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        "rounded-md px-2.5 py-1 text-xs font-medium",
                        item.ok
                          ? "bg-white/[0.06] text-slate-200"
                          : "bg-amber-500/10 text-amber-300"
                      ].join(" ")}
                    >
                      {item.ok ? "Ready" : "Needs attention"}
                    </span>
                    <Link
                      href={item.href}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 transition hover:bg-white/[0.08]"
                    >
                      {item.action}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Layout>
    </RoleGate>
  );
}

function FlowCard({
  title,
  value,
  hint
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0b0c] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={[
          "text-sm font-medium",
          tone === "warn" ? "text-amber-300" : "text-slate-100"
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
