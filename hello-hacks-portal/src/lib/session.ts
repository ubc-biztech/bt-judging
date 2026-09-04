// lib/session.ts
import { useEffect, useState } from "react";
import { EVENT_ID } from "./firebase";

export type Session =
  | { role: "admin"; adminCode: string; name?: string }
  | { role: "judge"; judgeId: string; judgeCode: string; name?: string }
  | { role: "team"; teamId: string; teamCode: string; name?: string };

// Require a new sign-in when switching events on the same site.
const KEY = `hh_session_v1:${EVENT_ID}`;

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(
    new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(s) })
  );
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(
    new StorageEvent("storage", { key: KEY, newValue: null })
  );
}

export function useClientSession(): {
  ready: boolean;
  session: Session | null;
} {
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
