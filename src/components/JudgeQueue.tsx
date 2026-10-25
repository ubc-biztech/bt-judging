import Link from "next/link";
import Layout from "./Layout";
import RoleGate from "./RoleGate";
import { Status } from "./Feedback";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { eventOrEmpty, listReviews, errorMessage } from "@/lib/bt";
import { PHASE_LABELS, PHASE_HELP } from "@/lib/ux";
import { isProductPlus, roundLabel } from "@/lib/event";
export default function JudgeQueue({ round }: { round: "prelim" | "finals" }) {
  return (
    <RoleGate allow={["judge"]}>
      <Layout>
        <Page round={round} />
      </Layout>
    </RoleGate>
  );
}
function Page({ round }: { round: "prelim" | "finals" }) {
  const { session } = useClientSession();
  const judgeId = session?.id;
  const poll = usePoll(
    judgeId
      ? async () => {
          const [doc, reviews] = await Promise.all([
            eventOrEmpty(),
            listReviews({ judgeId, round }),
          ]);
          return { doc, reviews };
        }
      : null,
    [judgeId, round],
  );
  const doc = poll.data?.doc;
  const settings = doc?.settings;
  const finalsJudge = !!judgeId && !!settings?.finalsJudgeIds.includes(judgeId);
  const assigned =
    round === "finals"
      ? finalsJudge
        ? (settings?.finalsTeamIds ?? [])
        : []
      : (doc?.judges.find((j) => j.id === judgeId)?.assignedTeamIds ?? []);
  const teams = assigned
    .map((id) => doc?.teams.find((t) => t.id === id))
    .filter((t) => !!t);
  const reviewed = new Set(poll.data?.reviews.map((r) => r.teamId));
  const done = teams.filter((t) => reviewed.has(t.id)).length;
  const next = teams.find((t) => !reviewed.has(t.id));
  const queue = round === "finals" ? "/judge/finals" : "/judge";
  return (
    <div className="judge-queue max-w-4xl space-y-5">
      <h1 className="text-3xl font-semibold">
        {round === "finals" || isProductPlus()
          ? `${roundLabel(round)} judging`
          : "Assigned teams"}
      </h1>
      <Status
        loading={!doc && !poll.error}
        error={poll.error ? errorMessage(poll.error) : ""}
        onRetry={poll.refresh}
      />
      {doc && settings && (
        <>
          {(settings.phase !== round ||
            (round === "finals" && !finalsJudge)) && (
            <div className="border-l-2 border-[var(--blue)] pl-4 space-y-2">
              <p className="font-semibold">{PHASE_LABELS[settings.phase]}</p>
              <p className="text-sm text-slate-400">
                {PHASE_HELP[settings.phase]}
              </p>
              {settings.phase === "finals" &&
                round === "prelim" &&
                finalsJudge && (
                  <Link href="/judge/finals" className="ux-primary">
                    Open finals queue →
                  </Link>
                )}
              {round === "finals" && !finalsJudge && (
                <p>
                  You are not assigned as a finals judge.{" "}
                  <Link className="underline" href="/judge">
                    View {roundLabel("prelim").toLowerCase()} teams
                  </Link>
                </p>
              )}
            </div>
          )}
          {!!teams.length && (
            <p role="status" className="text-sm">
              {done} / {teams.length} reviews saved
              {done === teams.length && settings.phase === round
                ? " · All done. You can still edit while this round is open."
                : ""}
            </p>
          )}
          {settings.phase === round && next && (
            <Link
              href={`${queue}/${next.id}`}
              className="ux-primary w-full sm:w-auto"
            >
              {done ? "Continue judging" : "Start judging"} →
            </Link>
          )}
          <div>
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`${queue}/${t.id}`}
                className="judge-team-row"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">
                    {settings.anonymizeTeams
                      ? `Team ${t.id.slice(0, 4).toUpperCase()}`
                      : t.name}
                  </h2>
                  <span className="shrink-0 text-sm text-[var(--ink-3)]">
                    {reviewed.has(t.id)
                      ? "Review saved"
                      : settings.phase === round
                        ? "Score →"
                        : "View →"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {!teams.length && (
            <p className="text-sm text-slate-400">
              No teams assigned yet. Ask an organizer to check your assignments.
            </p>
          )}
        </>
      )}
    </div>
  );
}
