import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { db, EVENT_ID } from "./firebase";
import type { Judge, Team, Rubric, Review } from "./types";

// paths
export const ev = () => doc(db, "events", EVENT_ID);
export const judgesCol = () => collection(ev(), "judges");
export const teamsCol = () => collection(ev(), "teams");
export const reviewsCol = () => collection(ev(), "reviews");
export const rubricDoc = () => doc(ev(), "rubric", "default");
export const linksCol = () => collection(ev(), "links");

// lookups
export async function findJudgeByCode(code: string): Promise<Judge | null> {
  const q = query(judgesCol(), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) };
}

export async function getRubric(): Promise<Rubric> {
  const d = await getDoc(rubricDoc());
  return d.data() as Rubric;
}

export async function listTeams(): Promise<Team[]> {
  const qTeams = query(teamsCol(), orderBy("name"));
  const snap = await getDocs(qTeams);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function listTeamsByIds(ids: string[]): Promise<Team[]> {
  const all = await listTeams();
  const set = new Set(ids);
  return all.filter((t) => set.has(t.id));
}

export async function submitReview(args: {
  teamId: string;
  judgeId: string;
  judgeName: string;
  scores: Record<string, number>;
  feedback?: string;
  judgeCode: string;
  weights: Record<string, number>;
}) {
  const { calcTotals } = await import("./helpers");
  const { total, weightedTotal } = calcTotals(args.scores, args.weights);
  const id = `${args.teamId}__${args.judgeId}`;
  const review: Review = {
    id,
    eventId: EVENT_ID,
    teamId: args.teamId,
    judgeId: args.judgeId,
    judgeName: args.judgeName,
    scores: args.scores,
    feedback: args.feedback ?? "",
    total,
    weightedTotal,
    completedAt: serverTimestamp()
  };
  await setDoc(doc(reviewsCol(), id), {
    ...review,
    _judgeCode: args.judgeCode
  });
  return review;
}

export async function autoAssign({
  perTeamJudges = 2,
  adminCode
}: {
  perTeamJudges: number;
  adminCode: string;
}) {
  const teams = await listTeams();
  const jSnap = await getDocs(judgesCol());
  const judges = jSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((j) => !j.isAdmin);

  const buckets: Record<string, string[]> = {};
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    for (let k = 0; k < perTeamJudges; k++) {
      const j = judges[(i + k) % judges.length];
      buckets[j.id] ||= [];
      buckets[j.id].push(t.id);
    }
  }

  const adminDoc = doc(ev(), "admin", "assign");
  await setDoc(adminDoc, {
    _adminCode: adminCode,
    when: serverTimestamp(),
    note: "bulk-assign"
  });
  await Promise.all(
    Object.entries(buckets).map(async ([judgeId, teamIds]) => {
      const jRef = doc(judgesCol(), judgeId);
      const j = await getDoc(jRef);
      if (!j.exists()) return;
      await updateDoc(jRef, { assignedTeamIds: teamIds });
    })
  );

  return buckets;
}
