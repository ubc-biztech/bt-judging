import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "./Layout";
import RoleGate from "./RoleGate";
import RubricForm from "./RubricForm";
import ProjectDetails from "./ProjectDetails";
import { Status } from "./Feedback";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { judging, eventOrEmpty, listReviews, errorMessage } from "@/lib/bt";
import { PHASE_LABELS } from "@/lib/ux";
import type { JudgingEvent } from "@ubc-biztech/sdk";

export default function JudgeScorecard({
  round,
}: {
  round: "prelim" | "finals";
}) {
  return (
    <RoleGate allow={["judge"]}>
      <Layout>
        <Page round={round} />
      </Layout>
    </RoleGate>
  );
}
function Page({ round }: { round: "prelim" | "finals" }) {
  const { query } = useRouter();
  const teamId = typeof query.teamId === "string" ? query.teamId : "";
  const { session } = useClientSession();
  const judgeId = session?.id ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const poll = usePoll(
    teamId && judgeId
      ? async () => {
          const [doc, reviews] = await Promise.all([
            eventOrEmpty(),
            listReviews({ judgeId, round }),
          ]);
          return {
            doc,
            reviews,
            existing: reviews.find((r) => r.teamId === teamId),
          };
        }
      : null,
    [teamId, judgeId, round],
  );
  const doc = poll.data?.doc;
  const team = doc?.teams.find((t) => t.id === teamId);
  const eligible = (d: JudgingEvent) =>
    round === "finals"
      ? d.settings.finalsTeamIds.includes(teamId) &&
        d.settings.finalsJudgeIds.includes(judgeId)
      : !!d.judges
          .find((j) => j.id === judgeId)
          ?.assignedTeamIds?.includes(teamId);
  const readOnly =
    !doc || doc.settings.phase !== round || !eligible(doc) || !!poll.error;
  const queue = round === "finals" ? "/judge/finals" : "/judge";
  const assigned =
    round === "finals"
      ? doc?.settings.finalsJudgeIds.includes(judgeId)
        ? doc.settings.finalsTeamIds
        : []
      : (doc?.judges.find((j) => j.id === judgeId)?.assignedTeamIds ?? []);
  const nextTeam = doc?.teams.find(
    (t) =>
      assigned.includes(t.id) &&
      t.id !== teamId &&
      !poll.data?.reviews.some((r) => r.teamId === t.id),
  );
  async function submit(scores: Record<string, number>, feedback: string) {
    if (submitting || readOnly || !doc) return false;
    setSubmitting(true);
    setError("");
    try {
      const fresh = await eventOrEmpty();
      if (fresh.settings.phase !== round || !eligible(fresh))
        throw new Error(
          "This round or assignment changed. Your draft is still here; return to your queue to check the current round.",
        );
      if (JSON.stringify(fresh.rubric) !== JSON.stringify(doc.rubric))
        throw new Error(
          "The rubric changed. Copy your feedback, then reload and check the new scoring criteria.",
        );
      await judging().team(teamId).review({ scores, feedback });
      void poll.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <Link href={queue} className="text-sm underline">
        ← Back to {round === "finals" ? "finals" : "assigned teams"}
      </Link>
      <Status
        error={poll.error ? errorMessage(poll.error) : ""}
        loading={!doc && !poll.error}
        onRetry={poll.refresh}
      />
      {doc && !team && (
        <p>This team is no longer available. Return to your queue.</p>
      )}
      {doc && team && (
        <>
          <header>
            <p className="text-sm text-slate-400">
              {round === "finals" ? "Finals" : "Preliminary"} scorecard
            </p>
            <h1 className="text-3xl font-semibold">
              {doc.settings.anonymizeTeams
                ? `Team ${team.id.slice(0, 4).toUpperCase()}`
                : team.name}
            </h1>
          </header>
          {readOnly && (
            <p
              role="status"
              className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm"
            >
              Scoring unavailable. Current phase:{" "}
              {PHASE_LABELS[doc.settings.phase]}.
              {!eligible(doc) &&
                " This team is not assigned to you in this round."}{" "}
              Your draft is preserved.
            </p>
          )}
          <ProjectDetails
            team={team}
            showMembers={!doc.settings.anonymizeTeams}
          />
          <Status error={error} />
          {doc.rubric?.criteria.length ? (
            <RubricForm
              key={`${round}:${teamId}`}
              criteria={doc.rubric.criteria}
              scaleMax={doc.rubric.scaleMax}
              scoreMode={doc.rubric.scoreMode}
              defaultScores={poll.data?.existing?.scores}
              defaultFeedback={poll.data?.existing?.feedback}
              submitting={submitting}
              readOnly={readOnly}
              onSubmit={submit}
              afterSave={
                <div className="flex flex-wrap gap-3">
                  {nextTeam && !readOnly && (
                    <Link
                      href={`${queue}/${nextTeam.id}`}
                      className="ux-primary"
                    >
                      Next unreviewed team →
                    </Link>
                  )}
                  <Link href={queue} className="ux-secondary">
                    Back to{" "}
                    {round === "finals" ? "finals queue" : "assigned teams"}
                  </Link>
                </div>
              }
            />
          ) : (
            <p>The organizers have not saved a rubric yet.</p>
          )}
        </>
      )}
    </div>
  );
}
