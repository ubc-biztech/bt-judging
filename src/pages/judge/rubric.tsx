"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import { normalizeRubric, rubricTotalMax } from "@/lib/judging";
import { Rubric } from "@/lib/types";
import { doc, onSnapshot } from "firebase/firestore";

function Page() {
  const [rubric, setRubric] = useState<Rubric>(normalizeRubric());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", EVENT_ID, "rubric", "default"), (snap) => {
      if (snap.exists()) {
        setRubric(normalizeRubric(snap.data() as Partial<Rubric>));
        return;
      }
      setRubric(normalizeRubric());
    });

    return () => unsub();
  }, []);

  const totalMax = rubricTotalMax(rubric);

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-[#0b1221]/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              Judging Rubric
            </h1>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Total / {totalMax}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {rubric.criteria.map((criterion) => (
              <div
                key={criterion.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-100">
                    {criterion.label}
                  </div>
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-200">
                    /{criterion.maxScore}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {criterion.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default function JudgeRubricPage() {
  return (
    <RoleGate allow={["judge"]}>
      <Page />
    </RoleGate>
  );
}
