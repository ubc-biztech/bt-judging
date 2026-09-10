import { useEffect, useState } from "react";
import { Criterion } from "@/lib/types";
import {
  criterionMax,
  rubricTotalMax,
  rubricUsesPointTotals
} from "@/lib/judging";

function clampScore(value: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export default function RubricForm({
  criteria,
  scaleMax,
  onSubmit,
  submitting,
  defaultScores,
  defaultFeedback,
  scoreMode,
  readOnly = false
}: {
  criteria: Criterion[];
  scaleMax: number;
  scoreMode?: "points" | "weighted";
  submitting?: boolean;
  onSubmit: (
    scores: Record<string, number>,
    feedback: string
  ) => void | Promise<void>;
  /** Optional: prefill the rubric with an existing review’s scores */
  defaultScores?: Record<string, number>;
  /** Optional: prefill the feedback text */
  defaultFeedback?: string;
  /** Optional: render in read-only mode (disables inputs & submit) */
  readOnly?: boolean;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const pointTotals = rubricUsesPointTotals({ criteria, scaleMax, scoreMode });
  const totalMax = rubricTotalMax({ criteria, scaleMax });

  useEffect(() => {
    const s: Record<string, number> = {};
    for (const c of criteria) {
      const max = criterionMax(c, scaleMax);
      s[c.id] = clampScore(defaultScores?.[c.id] ?? 0, max);
    }
    setScores(s);
  }, [criteria, defaultScores, scaleMax]);

  useEffect(() => {
    if (typeof defaultFeedback === "string") setFeedback(defaultFeedback);
  }, [defaultFeedback]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const normalized: Record<string, number> = {};
        for (const c of criteria) {
          const max = criterionMax(c, scaleMax);
          normalized[c.id] = clampScore(scores[c.id] ?? 0, max);
        }
        onSubmit(normalized, feedback);
      }}
      className="space-y-6"
    >
      <div className="rounded-2xl border border-white/10 bg-[#0b1221]/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Scorecard Overview
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {pointTotals
                ? `This rubric scores directly in points for a total of ${totalMax}.`
                : "Each criterion uses its own score range and weight."}
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            Total / {totalMax}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {criteria.map((c) => {
          const max = criterionMax(c, scaleMax);
          const useSlider = max > 10;
          const score = clampScore(scores[c.id] ?? 0, max);

          return (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 p-4 dark:border-white/10"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {c.label}
                  </div>
                  {c.description && (
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <div>Max {max}</div>
                  {!pointTotals && <div>Weight {c.weight}</div>}
                </div>
              </div>

              {useSlider ? (
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={score}
                    disabled={readOnly}
                    onChange={(e) =>
                      setScores((s) => ({
                        ...s,
                        [c.id]: clampScore(Number(e.target.value), max)
                      }))
                    }
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      0 - {max}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={max}
                      step={1}
                      value={score}
                      disabled={readOnly}
                      onChange={(e) =>
                        setScores((s) => ({
                          ...s,
                          [c.id]: clampScore(Number(e.target.value), max)
                        }))
                      }
                      className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-right text-sm dark:border-white/10 dark:bg-transparent"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: max + 1 }).map((_, i) => {
                    const active = score === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        disabled={readOnly}
                        onClick={() =>
                          setScores((s) => ({
                            ...s,
                            [c.id]: i
                          }))
                        }
                        className={`rounded-lg border px-3 py-1 text-sm transition
                      ${
                        active
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/5"
                      }`}
                      >
                        {i}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Selected: <span className="font-medium">{score}</span> / {max}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Feedback
        </label>
        <textarea
          className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-transparent"
          rows={4}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Share constructive feedback…"
          disabled={readOnly}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const cleared: Record<string, number> = {};
            for (const c of criteria) {
              const max = criterionMax(c, scaleMax);
              cleared[c.id] = clampScore(0, max);
            }
            setScores(cleared);
            setFeedback("");
          }}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          disabled={readOnly || submitting}
        >
          Clear
        </button>

        <button
          type="submit"
          disabled={readOnly || submitting}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </div>
    </form>
  );
}
