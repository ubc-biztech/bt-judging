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
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") void finish();
      if (payload.event === "signInWithRedirect_failure") setErr("Google sign-in failed.");
    });
    void finish();
    const giveUp = setTimeout(() => {
      if (!done) router.replace("/auth");
    }, 15000);
    return () => {
      stop();
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
