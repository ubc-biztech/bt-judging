/**
 * The BizTech API for this app. Pages call the SDK chain directly for writes:
 *
 *   await judging().team(id).update({ ... });          // a team, with its code
 *   await judging().team(id).review({ scores });       // a judge, with their code
 *   await saveEvent((doc) => ({ ...doc, links }));      // an organizer, with their Cognito token
 *
 * and use the readers below, which pick the right call for whoever is signed in. The event
 * is one document on the backend (settings, rubric, links, judges, teams); a judge or team
 * reads it with `get()`, an organizer with `admin.get()` (which includes every code) and
 * replaces it whole with `admin.set()`. Reviews are separate.
 */
import {
  ApiError,
  ContractViolationError,
  EventNotFoundError,
  ForbiddenError,
  NotAuthenticatedError,
  TeamNotFoundError,
  createClient,
  type JudgingAdminReviewsInput,
  type JudgingAdminSetInput,
  type JudgingEvent,
  type JudgingSettings,
  type Review,
  type Rubric,
} from "@ubc-biztech/sdk";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { configureAmplify } from "./amplify";
import { DEFAULT_EVENT_NAME, EVENT } from "./event";
import { clearSession, getSession, setSession, type Session } from "./session";

export const API_URL =
  process.env.NEXT_PUBLIC_BT_API_URL?.trim() ||
  (process.env.NEXT_PUBLIC_STAGE === "production"
    ? "https://api.ubcbiztech.com"
    : "https://api-dev.ubcbiztech.com");

/** The organizer's Cognito ID token, or null when there is no Cognito session. */
export async function cognitoIdToken(): Promise<string | null> {
  configureAmplify();
  try {
    return (await fetchAuthSession()).tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** The one client. A judge's or team's code, or an organizer's token, whichever is signed in. */
export const bt = createClient({
  baseUrl: API_URL,
  getCode: () => {
    const s = getSession();
    return s && s.role !== "admin" ? s.code : null;
  },
  getToken: () => (getSession()?.role === "admin" ? cognitoIdToken() : null),
});

/** This deployment's event: `bt.judging("hellohacks", 2026)`. */
export const judging = () => bt.judging(EVENT.id, EVENT.year);

/** The same scope with an explicit code, for login (no session yet). */
export const judgingAs = (code: string) =>
  createClient({ baseUrl: API_URL, getCode: () => code }).judging(
    EVENT.id,
    EVENT.year,
  );

// ─── Session ─────────────────────────────────────────────────────────

/** Resolve a judge or team code server-side, store the session, return it. Throws UnknownCodeError. */
export async function loginWithCode(code: string): Promise<Session> {
  const trimmed = code.trim();
  const { me } = await judgingAs(trimmed).get();
  if (!me) throw new Error("The server did not say who this code belongs to.");
  const session: Session = {
    role: me.role,
    code: trimmed,
    id: me.id,
    name: me.name,
  };
  setSession(session);
  return session;
}

/**
 * After a Cognito sign-in: record the admin session and prove the account is a BizTech admin
 * with one admin call. A 404 is fine (the event is not set up yet); a 403 means not an exec.
 */
export async function loginAsAdmin(): Promise<Session> {
  configureAmplify();
  const tokens = (await fetchAuthSession()).tokens;
  const email = String(tokens?.idToken?.payload.email ?? "");
  if (!tokens?.idToken || !email) throw new Error("Not signed in.");
  const session: Session = {
    role: "admin",
    id: email,
    name: String(tokens.idToken.payload.name ?? email),
  };
  setSession(session);
  try {
    await judging().admin.get();
  } catch (e) {
    if (isNotFound(e)) return session;
    await logout();
    throw e instanceof ForbiddenError
      ? new Error("This account is not a BizTech admin.")
      : e;
  }
  return session;
}

export async function logout() {
  const wasAdmin = getSession()?.role === "admin";
  clearSession();
  if (wasAdmin) {
    try {
      await signOut();
    } catch {
      // The local session is gone either way.
    }
  }
}

// ─── Errors ──────────────────────────────────────────────────────────

/** A sentence a person can read, for any SDK error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ContractViolationError)
    return "The server answered in an unexpected shape. Tell the organizers.";
  if (e instanceof NotAuthenticatedError)
    return "You are signed out. Sign in again.";
  if (e instanceof ApiError)
    return e.status >= 500
      ? "The server had a problem. Try again."
      : ((e.details as { message?: string })?.message ?? e.message);
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
}
export const isNotFound = (e: unknown) =>
  e instanceof EventNotFoundError ||
  e instanceof TeamNotFoundError ||
  (e instanceof ApiError && e.status === 404);

/** `await orNull(judging().info())` — null instead of a 404 error, for "does it exist" reads. */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

// ─── Defaults ────────────────────────────────────────────────────────

export const PHASES: JudgingSettings["phase"][] = [
  "submission",
  "prelim",
  "finals",
  "closed",
];

export const DEFAULT_SETTINGS: JudgingSettings = {
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

/** What an event looks like before an organizer has saved anything. */
export const EMPTY_EVENT: JudgingEvent = {
  updatedAt: "",
  settings: DEFAULT_SETTINGS,
  rubric: null,
  links: [],
  judges: [],
  teams: [],
};

// ─── Reads ───────────────────────────────────────────────────────────

/**
 * The event document as the signed-in role may see it: with every code for an organizer, without
 * codes for a judge or team. Null when nobody is signed in or the event is not set up yet.
 */
export async function loadEvent(): Promise<JudgingEvent | null> {
  const s = getSession();
  if (!s) return null;
  return orNull(s.role === "admin" ? judging().admin.get() : judging().get());
}

/** `loadEvent()`, or the empty event, so pages always have something to render. */
export async function eventOrEmpty(): Promise<JudgingEvent> {
  return (await loadEvent()) ?? EMPTY_EVENT;
}

/**
 * The event's settings, or the defaults when nobody has set the event up yet. Signed out, only
 * the name and phase are public; the rest are defaults.
 */
export async function settingsOrDefaults(): Promise<JudgingSettings> {
  if (!getSession()) {
    const info = await orNull(judging().info());
    return { ...DEFAULT_SETTINGS, ...(info?.settings ?? {}) };
  }
  return (await loadEvent())?.settings ?? DEFAULT_SETTINGS;
}

/** Reviews, as the signed-in role may see them. Organizers see everything. */
export async function listReviews(
  filters: JudgingAdminReviewsInput = {},
): Promise<Review[]> {
  return getSession()?.role === "admin"
    ? judging().admin.reviews(filters)
    : judging().reviews.list(filters);
}

// ─── Organizer writes ────────────────────────────────────────────────

/** The document without the fields the backend owns; what `admin.set` takes. */
export type EditableEvent = JudgingAdminSetInput;

/**
 * Read the document fresh, apply `patch`, write it back whole. Judges and teams keep their ids and
 * codes because they are passed back; a new one (no id) gets both minted. Last write wins, so
 * keep the read-to-write window short: compute nothing slow inside `patch`.
 */
export async function saveEvent(
  patch: (doc: EditableEvent) => EditableEvent,
): Promise<JudgingEvent> {
  const current = (await orNull(judging().admin.get())) ?? EMPTY_EVENT;
  const { me: _me, updatedAt: _updatedAt, ...editable } = current;
  void _me;
  void _updatedAt;
  const saved = await judging().admin.set(patch(editable));
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("judging:update"));
  return saved;
}

/** `settings` is part of the whole-document write; this changes some fields and keeps the rest. */
export const patchSettings = (patch: Partial<JudgingSettings>) =>
  saveEvent((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

export const setRubric = (rubric: Rubric | null) =>
  saveEvent((d) => ({ ...d, rubric }));

export const setLinks = (
  links:
    | EditableEvent["links"]
    | ((links: EditableEvent["links"]) => EditableEvent["links"]),
) =>
  saveEvent((d) => ({
    ...d,
    links: typeof links === "function" ? links(d.links) : links,
  }));

export const setJudges = (
  judges:
    | EditableEvent["judges"]
    | ((judges: EditableEvent["judges"]) => EditableEvent["judges"]),
) =>
  saveEvent((d) => ({
    ...d,
    judges: typeof judges === "function" ? judges(d.judges) : judges,
  }));

export const setTeams = (
  teams:
    | EditableEvent["teams"]
    | ((teams: EditableEvent["teams"]) => EditableEvent["teams"]),
) =>
  saveEvent((d) => ({
    ...d,
    teams: typeof teams === "function" ? teams(d.teams) : teams,
  }));

/** A stable id for links, which the portal chooses (judges and teams get theirs from the backend). */
export const newLinkId = () =>
  `link_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
