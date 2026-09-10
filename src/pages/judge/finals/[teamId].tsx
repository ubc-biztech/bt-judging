"use client";

import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import {
  errorMessage,
  getRubric,
  getSettings,
  getTeam,
  listReviews,
  submitReview
} from "@/lib/data";
import { normalizeRubric } from "@/lib/judging";
import { usePoll } from "@/lib/usePoll";
import { useClientSession } from "@/lib/session";
import RubricForm from "@/components/RubricForm";

export default function JudgeFinalTeam() {
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
  const judgeId = ready && session?.role === "judge" ? session.id : null;

  const [submitting, setSubmitting] = useState(false);
  const active = ready && !!judgeId && !!teamId;

  const { data: settings } = usePoll(active ? getSettings : null, [active]);

  const fetchTeam = useCallback(() => getTeam(teamId), [teamId]);
  const { data: team } = usePoll(active ? fetchTeam : null, [active, teamId]);

  const { data: serverRubric, loading: rubricLoading } = usePoll(active ? getRubric : null, [active]);
  const rubric = useMemo(
    () => (serverRubric ? normalizeRubric(serverRubric) : null),
    [serverRubric]
  );

  const fetchExisting = useCallback(
    async () =>
      (await listReviews({ teamId, judgeId: judgeId as string, round: "finals" }))[0] ?? null,
    [teamId, judgeId]
  );
  const { data: existing, refresh: refreshExisting } = usePoll(active ? fetchExisting : null, [active, teamId, judgeId]);

  // Guard: finals phase, this judge is a finals judge, this team is a finalist.
  useEffect(() => {
    if (!settings || !judgeId || !teamId) return;
    if (settings.phase !== "finals") {
      router.replace("/judge");
      return;
    }
    if (!settings.finalsJudgeIds.includes(judgeId)) {
      router.replace("/judge/finals");
      return;
    }
    if (!settings.finalsTeamIds.includes(teamId)) {
      router.replace("/judge/finals");
    }
  }, [settings, judgeId, teamId, router]);

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
      // Phase is "finals" here, so the server files this as a finals review and computes totals.
      await submitReview(team.id, scores, feedback);
      alert("Finals review submitted!");
      await refreshExisting();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            {displayName} (Finals)
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Phase: {settings?.phase || "—"} {isClosed ? "(read-only)" : ""}
          </p>
        </div>
        <button
          onClick={() => history.back()}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Back
        </button>
      </div>

      {/* Team details */}
      {team ? (
        <div className="mb-6 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
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
                <a className="underline" href={team.github} target="_blank">
                  Repo
                </a>
              </div>
            ) : null}
            {team.devpost ? (
              <div>
                <span className="font-medium">Devpost:</span>{" "}
                <a className="underline" href={team.devpost} target="_blank">
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
