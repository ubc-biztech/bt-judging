/**
 * Everything the pages need, on the BizTech SDK. Pages import from here and never from the
 * SDK directly, so the shape of a page does not change when the API does.
 *
 * Reads are plain async functions: wrap them in `usePoll` for live-ish views.
 * Writes return the new server state; call `refresh()` on any poll that shows it.
 */
import { ApiError, ContractViolationError, type BtError } from "@ubc-biztech/sdk";
import type {
  Judge,
  JudgingLink,
  JudgingSession,
  JudgingSettings,
  JudgingSettingsSetInput,
  JudgingTeam,
  JudgingTeamsCreateInput,
  Review,
  Rubric,
  JudgingRubricSetInput,
} from "@ubc-biztech/sdk";
import { judging, judgingAs } from "./bt";
import { DEFAULT_EVENT_NAME } from "./event";
import { setSession, clearSession, type Session } from "./session";

export type { Judge, JudgingLink as Link, JudgingSettings as Settings, JudgingTeam as Team, Review, Rubric };
export type Round = Review["round"];
export type Phase = JudgingSettings["phase"];

export const PHASES: Phase[] = ["submission", "prelim", "finals", "closed"];

// ─── Errors ──────────────────────────────────────────────────────────

/** A message a person can read, for any SDK error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ContractViolationError) return "The server answered in an unexpected shape. Tell the organizers.";
  if (e instanceof ApiError) return e.status >= 500 ? "The server had a problem. Try again." : (e.details as { message?: string })?.message ?? e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as BtError).message);
  return String(e);
}
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

// ─── Session ─────────────────────────────────────────────────────────

/** Resolve a code, store the session, return it. Throws UnknownCodeError on a bad code. */
export async function login(code: string): Promise<Session> {
  const who: JudgingSession = await judgingAs(code).session.login({ code });
  const role = who.role === "judgingAdmin" ? "admin" : who.role;
  const session: Session = { role, code: code.trim(), id: who.id, name: who.name };
  setSession(session);
  return session;
}
export const logout = clearSession;

// ─── Settings ────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: JudgingSettingsSetInput = {
  eventName: DEFAULT_EVENT_NAME,
  phase: "submission",
  perTeamJudges: 3,
  finalsTopN: 5,
  finalsTeamIds: [],
  finalsJudgeIds: [],
  showTeamFeedback: true,
  allowJudgeSeeOthers: true,
  anonymizeTeams: false,
  lockSubmissions: false,
  maxImages: 10,
};

/** Settings, or the defaults when the event has not been set up yet (never throws for that). */
export async function getSettings(): Promise<JudgingSettings> {
  try {
    return await judging().settings.get();
  } catch (e) {
    if (isNotFound(e)) return { ...DEFAULT_SETTINGS, updatedAt: "" };
    throw e;
  }
}
export const setSettings = (s: JudgingSettingsSetInput) => judging().settings.set(s);
/** Change some fields, keeping the rest as they are on the server. */
export async function patchSettings(patch: Partial<JudgingSettingsSetInput>) {
  const { updatedAt: _u, ...current } = await getSettings();
  return setSettings({ ...current, ...patch });
}

// ─── Rubric ──────────────────────────────────────────────────────────

export async function getRubric(): Promise<Rubric | null> {
  try {
    return await judging().rubric.get();
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}
export const setRubric = (r: JudgingRubricSetInput) => judging().rubric.set(r);

// ─── Teams ───────────────────────────────────────────────────────────

export const listTeams = () => judging().teams.list();
export async function getTeam(id: string): Promise<JudgingTeam | null> {
  try {
    return await judging().team(id).get();
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}
export const createTeam = (t: JudgingTeamsCreateInput) => judging().teams.create(t);
export const updateTeam = (id: string, t: JudgingTeamsCreateInput) => judging().team(id).update(t);
export const deleteTeam = (id: string) => judging().team(id).delete();
export async function listTeamsByIds(ids: string[]) {
  const set = new Set(ids);
  return (await listTeams()).filter((t) => set.has(t.id));
}

// ─── Judges ──────────────────────────────────────────────────────────

export const listJudges = () => judging().judges.list();
export async function getJudge(id: string): Promise<Judge | null> {
  try {
    return await judging().judge(id).get();
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}
export const createJudge = (name: string, isAdmin = false) => judging().judges.create({ name, isAdmin });
export const updateJudge = (id: string, patch: { name?: string; isAdmin?: boolean; assignedTeamIds?: string[] }) => judging().judge(id).update(patch);
export const deleteJudge = (id: string) => judging().judge(id).delete();
export const autoAssign = (perTeamJudges?: number) => judging().judges.autoAssign(perTeamJudges ? { perTeamJudges } : {});

// ─── Reviews ─────────────────────────────────────────────────────────

export const listReviews = (filter: { round?: Round; teamId?: string; judgeId?: string } = {}) => judging().reviews.list(filter);
/** Scores for the current phase's round; the server computes totals from the rubric. */
export const submitReview = (teamId: string, scores: Record<string, number>, feedback?: string) => judging().reviews.submit({ teamId, scores, feedback });
export const deleteReview = (id: string) => judging().review(id).delete();
export const reviewId = (round: Round, teamId: string, judgeId: string) => `${round}__${teamId}__${judgeId}`;

// ─── Links ───────────────────────────────────────────────────────────

export const listLinks = () => judging().links.list();
export const createLink = (label: string, url: string, order?: number) => judging().links.create({ label, url, order });
export const deleteLink = (id: string) => judging().link(id).delete();
