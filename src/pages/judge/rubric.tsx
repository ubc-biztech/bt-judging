"use client";

import { useState } from "react";
import { Status } from "@/components/Feedback";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { JUDGING_ROUNDS, type JudgingRound, criterionMax, rubricForRound, rubricTotalMax } from "@/lib/judging";
import { isProductPlus, roundLabel } from "@/lib/event";
import { PRODUCT_PLUS_PROTOTYPE_GUIDANCE } from "@/lib/product-plus";
import ScoringGuide from "@/components/ScoringGuide";
import { usePoll } from "@/lib/usePoll";
import { errorMessage, eventOrEmpty } from "@/lib/bt";

function Page() {
  const { data: doc, loading, error, refresh } = usePoll(eventOrEmpty, []);
  const [selectedRound, setRound] = useState<JudgingRound | null>(null);
  const round = selectedRound ?? (doc?.settings.phase === "finals" || doc?.settings.phase === "closed" ? "finals" : "prelim");
  const rubric = rubricForRound(doc, round);

  const totalMax = rubric ? rubricTotalMax(rubric) : 0;

  return (
    <Layout>
      <div className="max-w-5xl space-y-6">
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              {rubric?.name || "Judging rubric"}
            </h1>
            <span className="text-sm text-[var(--ink-3)]">
              {rubric ? `Total / ${Number(totalMax.toFixed(2))}` : ""}
            </span>
          </div>

          <div role="group" aria-label="Rubric round" className="flex gap-1 border-b border-[var(--line)] pb-2">
            {JUDGING_ROUNDS.map((r) => (
              <button key={r} type="button" className="ux-tab" aria-pressed={round === r} onClick={() => setRound(r)}>{roundLabel(r)}</button>
            ))}
          </div>

          <Status error={error ? errorMessage(error) : ""} onRetry={refresh} />
          {isProductPlus() && (
            <div className="round-guidance">
              <p>{PRODUCT_PLUS_PROTOTYPE_GUIDANCE}</p>
            </div>
          )}
          {rubric ? (
            <div className="scorecard-criteria">
              {rubric.criteria.map((criterion, index) => (
                <div key={criterion.id} className="scorecard-criterion">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                      <span className="criterion-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {criterion.label}
                    </h2>
                    <span className="shrink-0 text-sm text-[var(--ink-3)]">
                      /{criterionMax(criterion, rubric.scaleMax)}
                    </span>
                  </div>
                  <ScoringGuide description={criterion.description} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              {loading
                ? "Loading rubric…"
                : error
                  ? ""
                  : "The organizers have not set a rubric yet."}
            </div>
          )}
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
