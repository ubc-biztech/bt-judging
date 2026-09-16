"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import PhaseControl from "@/components/PhaseControl";
import { Status } from "@/components/Feedback";
import { eventOrEmpty, listReviews, errorMessage } from "@/lib/bt";
import { usePoll } from "@/lib/usePoll";
import { setupSteps } from "@/lib/ux";

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
function Page() {
  const poll = usePoll(async () => {
    const [doc, reviews] = await Promise.all([eventOrEmpty(), listReviews()]);
    return { doc, reviews };
  }, []);
  const doc = poll.data?.doc;
  const reviews = poll.data?.reviews ?? [];
  const steps = doc ? setupSteps(doc) : [];
  const missing = steps.filter((s) => !s.done);
  const expected =
    doc?.judges.reduce(
      (sum, j) =>
        sum +
        (j.assignedTeamIds ?? []).filter((id) =>
          doc.teams.some((t) => t.id === id),
        ).length,
      0,
    ) ?? 0;
  const completed = reviews.filter(
    (r) =>
      r.round === "prelim" &&
      doc?.judges.some(
        (j) => j.id === r.judgeId && j.assignedTeamIds?.includes(r.teamId),
      ),
  ).length;
  const uncovered =
    doc?.teams.filter(
      (t) =>
        doc.judges.filter((j) => j.assignedTeamIds?.includes(t.id)).length <
        (doc.settings.perTeamJudges ?? 3),
    ).length ?? 0;
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <button className="ux-secondary" onClick={() => void poll.refresh()}>
          Refresh
        </button>
      </div>
      <Status
        error={poll.error ? errorMessage(poll.error) : ""}
        loading={poll.loading}
        onRetry={() => void poll.refresh()}
      />
      {doc && (
        <>
          <PhaseControl doc={doc} onChange={() => void poll.refresh()} />
          {missing.length > 0 && (
            <section className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-5">
              <h2 className="font-semibold">Before judging starts</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {missing.map((step) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="ux-secondary"
                  >
                    {step.label} →
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Teams", doc.teams.length, "/admin/teams"],
              ["Judges", doc.judges.length, "/admin/judges"],
              ["Prelim reviews", `${completed} / ${expected}`, "/results"],
            ].map(([label, value, href]) => (
              <Link
                key={label}
                href={String(href)}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </Link>
            ))}
          </section>
          {uncovered > 0 && (
            <p className="text-sm text-amber-300">
              {uncovered} team{uncovered === 1 ? " has" : "s have"} fewer than{" "}
              {doc.settings.perTeamJudges ?? 3} judges.{" "}
              <Link className="underline" href="/admin/schedule">
                Check schedule
              </Link>
            </p>
          )}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold">Setup</h2>
            <ul className="mt-3 divide-y divide-gray-100">
              {steps.map((step) => (
                <li
                  key={step.href}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span>{step.label}</span>
                  <Link
                    href={step.href}
                    className={
                      step.done
                        ? "text-sm text-slate-400 underline"
                        : "text-sm font-semibold text-blue-600 underline"
                    }
                  >
                    {step.done ? "Ready · Edit" : "Set up →"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
