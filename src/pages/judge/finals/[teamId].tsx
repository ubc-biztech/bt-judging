"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import { computeReviewTotals, normalizeRubric } from "@/lib/judging";
import { Rubric } from "@/lib/types";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where
} from "firebase/firestore";
import { useClientSession } from "@/lib/session";
import RubricForm from "@/components/RubricForm";

type Team = {
  id: string;
  name: string;
  members?: string[];
  github?: string;
  devpost?: string;
  description?: string;
  imageUrls?: string[];
};

type EventSettings = {
  phase?: string;
  finalsJudgeIds?: string[];
  finalsTeamIds?: string[];
  anonymizeTeams?: boolean;
};

type ExistingReview = {
  id: string;
  teamId?: string;
  judgeId?: string;
  judgeName?: string;
  round?: string;
  scores?: Record<string, number>;
  feedback?: string;
  total?: number;
  weightedTotal?: number;
  createdAt?: Date;
};

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
  const judgeId = ready && session?.role === "judge" ? session.judgeId : null;
  const judgeName =
    ready && session?.role === "judge" ? session.name || "Judge" : "";

  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [rubric, setRubric] = useState<Rubric>(normalizeRubric());
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready || !judgeId || !teamId) return;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(doc(db, "events", EVENT_ID), (sSnap) => {
        const sData = sSnap.exists() ? (sSnap.data() as EventSettings) : {};
        setSettings(sData);
        if (sData.phase !== "finals") {
          router.replace("/judge");
          return;
        }

        const finalsJudgeIds: string[] = sData.finalsJudgeIds || [];
        const finalsTeamIds: string[] = sData.finalsTeamIds || [];
        if (!finalsJudgeIds.includes(judgeId)) {
          router.replace("/judge/finals");
          return;
        }
        if (!finalsTeamIds.includes(teamId)) {
          router.replace("/judge/finals");
        }
      })
    );

    unsubs.push(
      onSnapshot(doc(db, "events", EVENT_ID, "teams", teamId), (tSnap) => {
        if (tSnap.exists()) {
          setTeam({ id: tSnap.id, ...(tSnap.data() as Omit<Team, "id">) });
        } else {
          setTeam(null);
        }
      })
    );

    unsubs.push(
      onSnapshot(doc(db, "events", EVENT_ID, "rubric", "default"), (rSnap) => {
        if (rSnap.exists()) {
          setRubric(normalizeRubric(rSnap.data() as Partial<Rubric>));
        } else {
          setRubric(normalizeRubric());
        }
      })
    );

    const q1 = query(
      collection(db, "events", EVENT_ID, "reviews"),
      where("teamId", "==", teamId),
      where("judgeId", "==", judgeId),
      where("round", "==", "finals")
    );
    unsubs.push(
      onSnapshot(q1, (rs) => {
        if (!rs.empty) {
          setExisting({
            id: rs.docs[0].id,
            ...(rs.docs[0].data() as Omit<ExistingReview, "id">)
          });
        } else {
          setExisting(null);
        }
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [ready, judgeId, teamId, router]);

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
      const { total, weightedTotal } = computeReviewTotals(rubric, scores);

      const reviewId = `${team.id}__${judgeId}__finals`;
      await setDoc(
        doc(db, "events", EVENT_ID, "reviews", reviewId),
        {
          teamId: team.id,
          judgeId,
          judgeName,
          round: "finals",
          scores,
          feedback,
          total,
          weightedTotal,
          createdAt: new Date()
        },
        { merge: true }
      );

      alert("Finals review submitted!");
      setExisting({
        id: reviewId,
        teamId: team.id,
        judgeId,
        judgeName,
        round: "finals",
        scores,
        feedback,
        total,
        weightedTotal,
        createdAt: new Date()
      });
    } catch (e: unknown) {
      alert(
        e instanceof Error ? e.message : "Error submitting finals review."
      );
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
      {rubric.criteria.length > 0 ? (
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
          Loading rubric…
        </div>
      )}
    </div>
  );
}
