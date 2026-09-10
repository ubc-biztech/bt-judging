/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { DEFAULT_EVENT_NAME } from "@/lib/event";
import { db, EVENT_ID } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { setSession, getSession } from "@/lib/session";

export default function Auth() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "judge" | "team">("judge");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = getSession();
    if (s?.role === "admin") router.replace("/admin");
    if (s?.role === "judge") router.replace("/judge");
    if (s?.role === "team") router.replace("/submit");
  }, [router]);

  async function signIn() {
    setErr("");
    try {
      const codeTrim = code.trim();
      if (!codeTrim) throw new Error("Enter a code.");
      if (role === "admin") {
        const qj = query(
          collection(db, "events", EVENT_ID, "judges"),
          where("code", "==", codeTrim),
          where("isAdmin", "==", true)
        );
        const snap = await getDocs(qj);
        if (snap.empty) throw new Error("Admin code not found.");
        const d = snap.docs[0];
        setSession({
          role: "admin",
          adminCode: codeTrim,
          name: (d.data() as any).name || "Admin"
        });
        router.push("/admin");
        return;
      }
      if (role === "judge") {
        const qj = query(
          collection(db, "events", EVENT_ID, "judges"),
          where("code", "==", codeTrim)
        );
        const snap = await getDocs(qj);
        if (snap.empty) throw new Error("Judge code not found.");
        const d = snap.docs[0];
        const data = d.data() as any;
        setSession({
          role: "judge",
          judgeId: d.id,
          judgeCode: codeTrim,
          name: data.name || "Judge"
        });
        router.push("/judge");
        return;
      }
      // team
      const qt = query(
        collection(db, "events", EVENT_ID, "teams"),
        where("teamCode", "==", codeTrim)
      );
      const ts = await getDocs(qt);
      if (ts.empty) throw new Error("Team code not found.");
      const t = ts.docs[0];
      setSession({
        role: "team",
        teamId: t.id,
        teamCode: codeTrim,
        name: (t.data() as any).name || "Team"
      });
      router.push("/submit");
    } catch (e: any) {
      setErr(e.message || "Sign-in failed");
    }
  }

  const roleInfo: Record<
    "admin" | "judge" | "team",
    { title: string; codeLabel: string; placeholder: string }
  > = {
    admin: {
      title: "Admin",
      codeLabel: "Admin Code",
      placeholder: "ADMIN-1234"
    },
    judge: {
      title: "Judge",
      codeLabel: "Judge Code",
      placeholder: "JUDGE-1234"
    },
    team: {
      title: "Team",
      codeLabel: "Team Code",
      placeholder: "TEAM-0001"
    }
  };

  const current = roleInfo[role];

  return (
    <Layout>
      <div className="mx-auto grid max-w-5xl gap-4 py-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-xl border border-white/10 bg-[#0c0c0d] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-7">
          <span className="inline-flex rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {DEFAULT_EVENT_NAME}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Sign in
          </h1>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {(["admin", "judge", "team"] as const).map((r) => {
              const selected = role === r;
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={[
                    "rounded-lg border px-4 py-4 text-left transition",
                    selected
                      ? "border-white/25 bg-[#1a1a1b] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold">{roleInfo[r].title}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111214] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Sign In As {current.title}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">
            Code
          </h2>

          <div className="mt-10">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {current.codeLabel}
            </label>
            <input
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-4 py-3.5 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-white/20 focus:bg-[#090909]"
              placeholder={current.placeholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={signIn}
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-slate-200"
            >
              Continue
            </button>
            <button
              onClick={() => router.push("/results")}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]"
            >
              View Results
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
