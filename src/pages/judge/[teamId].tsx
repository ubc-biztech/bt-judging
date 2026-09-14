"use client";

import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { normalizeRubric } from "@/lib/judging";
import { usePoll } from "@/lib/usePoll";
import { useClientSession } from "@/lib/session";

import RubricForm from "@/components/RubricForm";
import { judging, errorMessage, eventOrEmpty, listReviews } from "@/lib/bt";

export default function JudgeTeamPage() {
  return (
    <RoleGate allow={["judge"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const router = useRouter();
  const { teamId } = router.query as { teamId: string };
  const { ready, session } = useClientSession();

  const [submitting, setSubmitting] = useState(false);
  const judgeId = ready && session?.role === "judge" ? session.id : null;

  // One document: settings, rubric, and the team, as the judge code may see it.
  const { data: doc, loading: rubricLoading } = usePoll(ready && teamId ? eventOrEmpty : null, [ready, teamId]);
  const settings = doc?.settings ?? null;
  const team = doc?.teams.find((t) => t.id === teamId) ?? null;
  const serverRubric = doc?.rubric ?? null;
  const rubric = useMemo(
    () => (serverRubric ? normalizeRubric(serverRubric) : null),
    [serverRubric]
  );

  const fetchExisting = useCallback(
    async () =>
      (await listReviews({ teamId, judgeId: judgeId as string, round: "prelim" }))[0] ?? null,
    [teamId, judgeId]
  );
  const { data: existing, refresh: refreshExisting } = usePoll(
    ready && teamId && judgeId ? fetchExisting : null,
    [ready, teamId, judgeId]
  );

  const displayName =
    settings?.anonymizeTeams && team
      ? `Team ${team.id.slice(0, 4).toUpperCase()}`
      : team?.name || "Team";

  const isClosed = settings?.phase === "closed";

  async function handleSubmit(
    scores: Record<string, number>,
    feedback: string
  ) {
    if (!team || !judgeId) return;
    if (isClosed) {
      alert("Judging is closed.");
      return;
    }
    setSubmitting(true);
    try {
      // The server picks the round from the current phase and computes totals from the rubric.
      await judging().team(team.id).review({ scores, feedback });
      alert("Submitted!");
      await refreshExisting();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            {displayName}
          </h1>
          {settings?.phase && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Phase: {settings.phase}
              {isClosed ? " (read-only)" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => router.back()}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Back
        </button>
      </div>

      {/* Team details */}
      {team ? (
        <div className="rounded-2xl border border-gray-200 p-4 mb-6 dark:border-white/10">
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            {team.members?.length ? (
              <div>
                <span className="font-medium">Members:</span>{" "}
                {team.members.join(", ")}
              </div>
            ) : null}
            {team.github ? (
              <div>
                <span className="font-medium">GitHub:</span>{" "}
                <a
                  className="underline"
                  href={team.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  Repo
                </a>
              </div>
            ) : null}
            {team.devpost ? (
              <div>
                <span className="font-medium">Devpost:</span>{" "}
                <a
                  className="underline"
                  href={team.devpost}
                  target="_blank"
                  rel="noreferrer"
                >
                  Link
                </a>
              </div>
            ) : null}
            {team.description ? (
              <p className="mt-2 text-sm leading-6">{team.description}</p>
            ) : null}
            {!!team.imageUrls?.length && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {team.imageUrls.slice(0, 10).map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt=""
                    className="aspect-video w-full rounded-lg object-cover border border-gray-200 dark:border-white/10"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Loading team…
        </div>
      )}

      {/* Rubric form */}
      {rubric && rubric.criteria.length > 0 ? (
        <RubricForm
          criteria={rubric.criteria}
          scaleMax={rubric.scaleMax}
          scoreMode={rubric.scoreMode}
          submitting={submitting}
          defaultScores={existing?.scores}
          defaultFeedback={existing?.feedback}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {rubricLoading ? "Loading rubric…" : "The organizers have not set a rubric yet."}
        </div>
      )}
    </div>
  );
}
