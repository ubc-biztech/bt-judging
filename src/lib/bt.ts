/**
 * The one BizTech API client for this app. Every data access goes through `judging()`.
 * The bearer token is the signed-in code (see session.ts); public calls work without one.
 */
import { createClient } from "@ubc-biztech/sdk";
import { EVENT } from "./event";
import { getSession } from "./session";

export const API_URL =
  process.env.NEXT_PUBLIC_BT_API_URL?.trim() ||
  (process.env.NEXT_PUBLIC_STAGE === "production" ? "https://api.ubcbiztech.com" : "https://api-dev.ubcbiztech.com");

export const bt = createClient({
  baseUrl: API_URL,
  getToken: () => getSession()?.code ?? null,
});

/** `bt.judging(eventSlug, year)` for this deployment's event. */
export const judging = () => bt.judging(EVENT.id, EVENT.year);

/** A client that authenticates with an explicit code, for login and for admin tools that act as someone else. */
export const judgingAs = (code: string) => createClient({ baseUrl: API_URL, getToken: () => code }).judging(EVENT.id, EVENT.year);
