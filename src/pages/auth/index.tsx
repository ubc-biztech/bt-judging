"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signIn, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Layout from "@/components/Layout";
import { fallbackEventName } from "@/lib/event";
import EventBrand from "@/components/EventBrand";
import { EventPicker, useEvents } from "@/components/EventProvider";
import { EVENT_ID, eventKey } from "@/lib/event";
import { UnknownCodeError } from "@ubc-biztech/sdk";
import { getSession, type Role } from "@/lib/session";
import {
  cognitoIdToken,
  loginAsAdmin,
  loginWithCode,
  errorMessage,
} from "@/lib/bt";
import { configureAmplify } from "@/lib/amplify";

const HOME: Record<Role, string> = {
  admin: "/admin",
  judge: "/",
  team: "/",
};

export default function Auth() {
  const router = useRouter();
  const { catalog } = useEvents();
  const selectedEvent = catalog?.events.find(
    (event) => eventKey(event) === EVENT_ID,
  );
  const eventName = selectedEvent?.eventName || fallbackEventName();
  const [method, setMethod] = useState<"code" | "admin">("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Already signed in: go home. Returning from Google with a Cognito session: finish the admin login.
  useEffect(() => {
    configureAmplify();
    const s = getSession();
    if (s) {
      router.replace(HOME[s.role]);
      return;
    }
    let cancelled = false;
    const finish = async () => {
      try {
        if (!(await cognitoIdToken())) return;
        await loginAsAdmin();
        if (!cancelled) router.replace("/admin");
      } catch (e) {
        if (!cancelled) {
          setMethod("admin");
          setErr(errorMessage(e));
        }
      }
    };
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void finish();
      if (payload.event === "signInWithRedirect_failure") {
        setMethod("admin");
        setErr("Google sign-in failed. Try email and password.");
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [router]);

  async function run(method: "code" | "admin", work: () => Promise<Role>) {
    if (busy) return;
    setErr("");
    setMethod(method);
    setBusy(true);
    try {
      router.push(HOME[await work()]);
    } catch (e) {
      setErr(
        e instanceof UnknownCodeError
          ? `Code not recognized for ${eventName}. Check your code or choose another event.`
          : errorMessage(e) || "Sign-in failed",
      );
    } finally {
      setBusy(false);
    }
  }

  const codeSignIn = () =>
    run("code", async () => {
      if (!code.trim()) throw new Error("Enter your code.");
      // The server resolves the role within the selected event.
      return (await loginWithCode(code)).role;
    });

  const adminSignIn = () =>
    run("admin", async () => {
      if (!email.trim() || !password)
        throw new Error("Enter your BizTech email and password.");
      configureAmplify();
      const attempt = () => signIn({ username: email.trim(), password });
      const { isSignedIn } = await attempt().catch(async (e) => {
        if (
          (e as { name?: string }).name !== "UserAlreadyAuthenticatedException"
        )
          throw e;
        await signOut();
        return attempt();
      });
      if (!isSignedIn)
        throw new Error(
          "Finish signing in to your account in the BizTech app, then try again here.",
        );
      return (await loginAsAdmin()).role;
    });

  const googleSignIn = async () => {
    if (busy) return;
    setMethod("admin");
    setBusy(true);
    setMethod("admin");
    setErr("");
    configureAmplify();
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-[#0c0c0d] p-6 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div className="flex min-w-0 items-center gap-4">
            <EventBrand
              name={eventName}
              imageUrl={selectedEvent?.imageUrl}
              className="h-16 w-24"
            />
            <div>
              <p className="text-sm text-slate-400">{eventName}</p>
              <h1 className="mt-1 text-3xl font-semibold">Sign in</h1>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <EventPicker disabled={busy} />
          </div>
        </header>
        <div className="grid md:grid-cols-2">
          <form
            aria-label="Judge or team sign in"
            className="py-6 md:pr-8"
            onSubmit={(e) => {
              e.preventDefault();
              void codeSignIn();
            }}
          >
            <h2 className="text-xl font-semibold">Judges & teams</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use your code for this event.
            </p>
            <label className="ux-label mt-6" htmlFor="code">
              Access code
            </label>
            <input
              id="code"
              required
              disabled={busy}
              spellCheck={false}
              className="ux-input"
              placeholder="Your access code"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {err && method === "code" && (
              <p role="alert" className="mt-3 text-sm text-rose-400">
                {err}
              </p>
            )}
            <button type="submit" disabled={busy} className="ux-primary mt-5">
              {busy && method === "code" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <form
            aria-label="Organizer sign in"
            className="border-t border-white/10 py-6 md:border-l md:border-t-0 md:pl-8"
            onSubmit={(e) => {
              e.preventDefault();
              void adminSignIn();
            }}
          >
            <h2 className="text-xl font-semibold">Organizers</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in with your BizTech account.
            </p>
            <label className="ux-label mt-6" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              required
              disabled={busy}
              className="ux-input"
              type="email"
              autoComplete="username"
              placeholder="you@ubcbiztech.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="ux-label mt-4" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              required
              disabled={busy}
              className="ux-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {err && method === "admin" && (
              <p role="alert" className="mt-3 text-sm text-rose-400">
                {err}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className="ux-primary">
                {busy && method === "admin" ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={googleSignIn}
                className="ux-secondary"
              >
                Sign in with Google
              </button>
            </div>
          </form>
        </div>
      </section>
    </Layout>
  );
}
