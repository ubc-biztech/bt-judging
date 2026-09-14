// lib/session.ts — who is signed in, kept in localStorage.
//
// Judges and teams: the `code` is sent as X-Judging-Code on every API call; the rest is what
// `judging.get` told us about it. Organizers: the role is a marker; the Cognito session held
// by Amplify is the credential, and lib/bt.ts fetches the ID token from it per call.
import { useEffect, useState } from "react";
import { EVENT_ID } from "./event";

export type Session =
  | { role: "admin"; id: string; name?: string; code?: undefined }
  | { role: "judge"; code: string; id: string; name?: string }
  | { role: "team"; code: string; id: string; name?: string };

export type Role = Session["role"];

// Require a new sign-in when switching events on the same site.
const KEY = `hh_session_v3:${EVENT_ID}`;

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(s) }));
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s || typeof s.id !== "string") return null;
    if (s.role === "admin") return s;
    if ((s.role === "judge" || s.role === "team") && typeof s.code === "string") return s;
    return null;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
}

export function useClientSession(): { ready: boolean; session: Session | null } {
  const [ready, setReady] = useState(false);
  const [session, setSess] = useState<Session | null>(null);

  useEffect(() => {
    setSess(getSession());
    setReady(true);
    const on = () => setSess(getSession());
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  return { ready, session };
}
