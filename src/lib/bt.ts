/**
 * The BizTech API for this app. Pages call the SDK chain directly:
 *
 *   const teams = await judging().teams.list();
 *   await judging().team(id).update({ ... });
 *
 * This file holds only what is not an API call: the client, the session login, turning
 * SDK errors into text, and the app's default settings for an event that is not set up yet.
 */
import { ApiError, ContractViolationError, createClient, type JudgingSettings, type JudgingSettingsSetInput } from "@ubc-biztech/sdk";
import { DEFAULT_EVENT_NAME, EVENT } from "./event";
import { clearSession, getSession, setSession, type Session } from "./session";

export const API_URL =
  process.env.NEXT_PUBLIC_BT_API_URL?.trim() ||
  (process.env.NEXT_PUBLIC_STAGE === "production" ? "https://api.ubcbiztech.com" : "https://api-dev.ubcbiztech.com");

/** The one client. The bearer token is the signed-in code; public calls work without one. */
export const bt = createClient({ baseUrl: API_URL, getToken: () => getSession()?.code ?? null });

/** This deployment's event: `bt.judging("hellohacks", 2027)`. */
export const judging = () => bt.judging(EVENT.id, EVENT.year);

/** The same scope with an explicit code, for login (no session yet). */
export const judgingAs = (code: string) => createClient({ baseUrl: API_URL, getToken: () => code }).judging(EVENT.id, EVENT.year);

// ─── Session ─────────────────────────────────────────────────────────

/** Resolve a code server-side, store the session, return it. Throws UnknownCodeError. */
export async function login(code: string): Promise<Session> {
  const who = await judgingAs(code).session.login({ code });
  const session: Session = { role: who.role === "judgingAdmin" ? "admin" : who.role, code: code.trim(), id: who.id, name: who.name };
  setSession(session);
  return session;
}
export const logout = clearSession;

// ─── Errors ──────────────────────────────────────────────────────────

/** A sentence a person can read, for any SDK error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ContractViolationError) return "The server answered in an unexpected shape. Tell the organizers.";
  if (e instanceof ApiError) return e.status >= 500 ? "The server had a problem. Try again." : ((e.details as { message?: string })?.message ?? e.message);
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** `await orNull(judging().team(id).get())` — null instead of a 404 error, for "does it exist" reads. */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

// ─── Settings defaults ───────────────────────────────────────────────

export const PHASES: JudgingSettings["phase"][] = ["submission", "prelim", "finals", "closed"];

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

/** The event's settings, or the defaults when nobody has set the event up yet. */
export async function settingsOrDefaults(): Promise<JudgingSettings> {
  return (await orNull(judging().settings.get())) ?? { ...DEFAULT_SETTINGS, updatedAt: "" };
}

/** `settings.set` is a full replace; this changes some fields and keeps the rest. */
export async function patchSettings(patch: Partial<JudgingSettingsSetInput>): Promise<JudgingSettings> {
  const { updatedAt: _u, ...current } = await settingsOrDefaults();
  void _u;
  return judging().settings.set({ ...current, ...patch });
}
