"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { signIn, signInWithRedirect, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Layout from "@/components/Layout";
import { DEFAULT_EVENT_NAME } from "@/lib/event";
import { getSession, type Role } from "@/lib/session";
import { cognitoIdToken, loginAsAdmin, loginWithCode, errorMessage } from "@/lib/bt";
import { configureAmplify } from "@/lib/amplify";

const HOME: Record<Role, string> = { admin: "/admin", judge: "/judge", team: "/submit" };

export default function Auth() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("judge");
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
        if (!cancelled) setErr(errorMessage(e));
      }
    };
    void finish();
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void finish();
      if (payload.event === "signInWithRedirect_failure") setErr("Google sign-in failed. Try email and password.");
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [router]);

  async function run(work: () => Promise<Role>) {
    setErr("");
    setBusy(true);
    try {
      router.push(HOME[await work()]);
    } catch (e) {
      setErr(errorMessage(e) || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const codeSignIn = () =>
    run(async () => {
      if (!code.trim()) throw new Error("Enter your code.");
      // The server resolves the code to a role; the selector is only a hint.
      return (await loginWithCode(code)).role;
    });

  const adminSignIn = () =>
    run(async () => {
      if (!email.trim() || !password) throw new Error("Enter your BizTech email and password.");
      configureAmplify();
      const attempt = () => signIn({ username: email.trim(), password });
      const { isSignedIn, nextStep } = await attempt().catch(async (e) => {
        if ((e as { name?: string }).name !== "UserAlreadyAuthenticatedException") throw e;
        await signOut();
        return attempt();
      });
      if (!isSignedIn) throw new Error(`Finish setting up your account in the BizTech app first (${nextStep.signInStep}).`);
      return (await loginAsAdmin()).role;
    });

  const googleSignIn = async () => {
    setErr("");
    configureAmplify();
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  const roleInfo: Record<Role, { title: string; hint: string }> = {
    admin: { title: "Organizer", hint: "Your BizTech exec account" },
    judge: { title: "Judge", hint: "The code an organizer gave you" },
    team: { title: "Team", hint: "Your team's code" }
  };

  const input =
    "mt-3 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-4 py-3.5 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-white/20 focus:bg-[#090909]";
  const label = "text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
  const primary = "rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-60";
  const secondary = "rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-60";

  return (
    <Layout>
      <div className="mx-auto grid max-w-5xl gap-4 py-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-xl border border-white/10 bg-[#0c0c0d] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-7">
          <span className="inline-flex rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {DEFAULT_EVENT_NAME}
          </span>
          <div className="asset-placeholder relative mt-6 h-16 w-44 rounded-md" data-asset="hello hacks logo" />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Sign in</h1>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {(["admin", "judge", "team"] as const).map((r) => {
              const selected = role === r;
              return (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setErr("");
                  }}
                  className={[
                    "rounded-lg border px-4 py-4 text-left transition",
                    selected
                      ? "border-white/25 bg-[#1a1a1b] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold">{roleInfo[r].title}</p>
                  <p className="mt-1 text-xs text-slate-500">{roleInfo[r].hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111214] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sign In As {roleInfo[role].title}</p>

          {role === "admin" ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void adminSignIn();
              }}
            >
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">BizTech account</h2>
              <div className="mt-8">
                <label className={label}>Email</label>
                <input className={input} type="email" autoComplete="username" placeholder="you@ubcbiztech.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="mt-5">
                <label className={label}>Password</label>
                <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? "Signing in…" : "Continue"}
                </button>
                <button type="button" disabled={busy} onClick={googleSignIn} className={secondary}>
                  Sign in with Google
                </button>
              </div>
              <p className="mt-6 text-xs text-slate-500">Only BizTech exec accounts can organize. Judges and teams use a code instead.</p>
            </form>
          ) : (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void codeSignIn();
              }}
            >
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Code</h2>
              <div className="mt-10">
                <label className={label}>{roleInfo[role].title} Code</label>
                <input className={input} placeholder="XXXX-XXXX" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
                {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="submit" disabled={busy} className={primary}>
                  {busy ? "Signing in…" : "Continue"}
                </button>
                <button type="button" onClick={() => router.push("/results")} className={secondary}>
                  View Results
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </Layout>
  );
}
