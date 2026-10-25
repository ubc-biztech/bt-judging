import { useRef, useState, type ReactNode } from "react";
import type { Criterion } from "@/lib/types";
import { isProductPlus } from "@/lib/event";
import {
  criterionMax,
  computeReviewTotals,
  rubricTotalMax,
  rubricUsesPointTotals,
} from "@/lib/judging";
import { Status } from "./Feedback";
import ScoringGuide from "./ScoringGuide";

export default function RubricForm({
  criteria,
  scaleMax,
  onSubmit,
  submitting,
  submitError,
  defaultScores,
  defaultFeedback,
  scoreMode,
  readOnly = false,
  afterSave,
  minScore = 0,
}: {
  criteria: Criterion[];
  scaleMax: number;
  scoreMode?: "points" | "weighted";
  submitting?: boolean;
  submitError?: string;
  onSubmit: (
    scores: Record<string, number>,
    feedback: string,
  ) => Promise<boolean>;
  defaultScores?: Record<string, number>;
  defaultFeedback?: string;
  readOnly?: boolean;
  afterSave?: ReactNode;
  minScore?: number;
}) {
  const criterionNodes = useRef<Record<string, HTMLElement | null>>({});
  // The parent mounts one form per team and round, after loading the existing review.
  // Polls never replace a draft. Only a successful write advances the saved baseline.
  const [scores, setScores] = useState<Record<string, number>>(
    defaultScores ?? {},
  );
  const [feedback, setFeedback] = useState(defaultFeedback ?? "");
  const [saved, setSaved] = useState(
    JSON.stringify([defaultScores ?? {}, defaultFeedback ?? ""]),
  );
  const [hasReview, setHasReview] = useState(!!defaultScores);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify([scores, feedback]) !== saved;
  const rubric = {
    criteria,
    scaleMax,
    scoreMode: scoreMode ?? "points",
  };
  const points = rubricUsesPointTotals(rubric);
  const scored = criteria.filter(
    (c) =>
      Number.isInteger(scores[c.id]) &&
      scores[c.id] >= minScore &&
      scores[c.id] <= criterionMax(c, scaleMax),
  ).length;
  const complete = criteria.length > 0 && scored === criteria.length;
  const totals = computeReviewTotals(rubric, scores);
  const total = rubric.scoreMode === "weighted" ? totals.weightedTotal : totals.total;
  const formatScore = (value: number) =>
    value.toLocaleString("en-CA", { maximumFractionDigits: 2 });
  return (
    <form
      data-unsaved={dirty}
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (readOnly || submitting) return;
        setError("");
        setNotice("");
        if (!complete) {
          setError(
            minScore === 1
              ? "Choose a score from 1 to 10 for every criterion."
              : "Choose a score for every criterion. Zero is a valid score.",
          );
          const missing = criteria.find(
            (c) =>
              !Number.isInteger(scores[c.id]) ||
              scores[c.id] < minScore ||
              scores[c.id] > criterionMax(c, scaleMax),
          );
          if (missing) {
            criterionNodes.current[missing.id]?.focus({ preventScroll: true });
            criterionNodes.current[missing.id]?.scrollIntoView({
              block: "center",
            });
          }
          return;
        }
        if (
          await onSubmit(
            Object.fromEntries(criteria.map((c) => [c.id, scores[c.id]])),
            feedback,
          )
        ) {
          setSaved(JSON.stringify([scores, feedback]));
          setHasReview(true);
          setNotice("Review saved.");
        }
      }}
    >
      <fieldset disabled={readOnly || submitting} className="space-y-5">
        <div className="scorecard-criteria">
          {criteria.map((c, index) => {
            const max = criterionMax(c, scaleMax);
            const score = scores[c.id];
            return (
              <section
                key={c.id}
                ref={(el) => {
                  criterionNodes.current[c.id] = el;
                }}
                tabIndex={-1}
                aria-label={c.label}
                className="scorecard-criterion focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    <span className="criterion-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {c.label}
                  </h2>
                  <span className="shrink-0 text-sm text-slate-400">
                    / {max}
                    {!points &&
                      (isProductPlus()
                        ? ` · ${((c.weight / criteria.reduce((n, item) => n + item.weight, 0)) * 100).toFixed(1)}%`
                        : ` · ×${c.weight}`)}
                  </span>
                </div>
                <ScoringGuide
                  description={c.description}
                  score={score}
                  compact
                />
                {max > 10 ? (
                  <div className="space-y-2">
                    <input
                      aria-label={`${c.label} slider`}
                      type="range"
                      min={minScore}
                      max={max}
                      step={1}
                      value={score ?? minScore}
                      className="w-full"
                      onChange={(e) =>
                        setScores({ ...scores, [c.id]: Number(e.target.value) })
                      }
                    />
                    <label className="flex items-center justify-between gap-2 text-sm">
                      Score
                      <input
                        aria-label={`${c.label} score`}
                        className="ux-input !w-24"
                        type="number"
                        min={minScore}
                        max={max}
                        step={1}
                        required
                        value={score ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const next = { ...scores };
                          if (e.target.value === "") delete next[c.id];
                          else next[c.id] = Number(e.target.value);
                          setScores(next);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div
                    role="group"
                    aria-label={`${c.label} score`}
                    className="score-choices"
                  >
                    {Array.from(
                      { length: max - minScore + 1 },
                      (_, i) => i + minScore,
                    ).map((value) => (
                      <label key={value} className="score-choice">
                        <input
                          type="radio"
                          name={`score-${c.id}`}
                          value={value}
                          checked={score === value}
                          aria-label={`${c.label}: ${value} out of ${max}`}
                          onChange={() =>
                            setScores({ ...scores, [c.id]: value })
                          }
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="sr-only" aria-live="polite">
                  {score === undefined
                    ? "Choose a score"
                    : `Selected: ${score} / ${max}`}
                </p>
              </section>
            );
          })}
        </div>
        <label className="ux-label">
          Feedback{" "}
          <span className="text-xs text-slate-400">
            Optional · shared after release
          </span>
          <textarea
            className="ux-input resize-y"
            rows={6}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What worked well? What could improve?"
          />
        </label>
        {!readOnly && (
          <button
            type="button"
            className="scorecard-clear"
            disabled={!dirty || submitting}
            onClick={() => {
              if (
                !confirm(
                  "Clear the scores and feedback in this draft? Your saved review stays unchanged until you save again.",
                )
              )
                return;
              setScores({});
              setFeedback("");
              setNotice("");
            }}
          >
            Clear draft
          </button>
        )}
      </fieldset>
      <div className="scorecard-actions" data-saved={!dirty && !!notice}>
        <Status
          error={submitError || (complete ? "" : error)}
          notice={!dirty ? notice : ""}
        />
        <div className="scorecard-actions-row">
          <div className="text-sm" aria-live="polite" aria-atomic="true">
            {complete ? (
              <p className="scorecard-total">
                <span>Total</span>
                <span className="scorecard-total-value">
                  <strong>{formatScore(total)}</strong>
                  <span>/ {formatScore(rubricTotalMax(rubric))}</span>
                </span>
              </p>
            ) : (
              <p>
                {scored} / {criteria.length} scored
              </p>
            )}
            {dirty && <p className="text-xs text-[var(--ink-3)]">Unsaved</p>}
          </div>
          {!readOnly && (
            <button
              type="submit"
              className="ux-primary"
              disabled={submitting || (hasReview && !dirty)}
            >
              {submitting
                ? "Saving…"
                : hasReview
                  ? "Save review changes"
                  : "Submit review"}
            </button>
          )}
        </div>
      </div>
      {!dirty && notice && afterSave}
    </form>
  );
}
