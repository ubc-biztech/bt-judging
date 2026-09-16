"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Hub } from "aws-amplify/utils";
import { configureAmplify } from "@/lib/amplify";
import { cognitoIdToken, loginAsAdmin, errorMessage } from "@/lib/bt";

/** Where Cognito's hosted UI returns to. Finishes the organizer login, then leaves. */
export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    configureAmplify();
    let done = false;
    const finish = async () => {
      if (done) return;
      if (!(await cognitoIdToken())) return;
      done = true;
      try {
        await loginAsAdmin();
        router.replace("/admin");
      } catch (e) {
        setErr(errorMessage(e));
      }
    };
    // Amplify exchanges the ?code for tokens as soon as the page loads, which can finish before this
    // effect runs and miss the Hub event. Poll the session as well.
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void finish();
      if (payload.event === "signInWithRedirect_failure") setErr("Google sign-in failed.");
    });
    const tick = setInterval(() => void finish(), 500);
    void finish();
    const giveUp = setTimeout(() => {
      if (!done) setErr("Still no session after 20 seconds. Try again from the sign-in page.");
    }, 20000);
    return () => {
      stop();
      clearInterval(tick);
      clearTimeout(giveUp);
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-slate-400">
      {err ? (
        <div className="text-center">
          <p className="text-rose-400">{err}</p>
          <button className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-100" onClick={() => router.replace("/auth")}>Back to sign in</button>
        </div>
      ) : (
        "Signing you in…"
      )}
    </div>
  );
}
