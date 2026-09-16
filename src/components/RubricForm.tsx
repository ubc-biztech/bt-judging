import { useState } from "react";
import type { Criterion } from "@/lib/types";
import {
  criterionMax,
  rubricTotalMax,
  rubricUsesPointTotals,
} from "@/lib/judging";
import { Status } from "./Feedback";

export default function RubricForm({
  criteria,
  scaleMax,
  onSubmit,
  submitting,
  defaultScores,
  defaultFeedback,
  scoreMode,
  readOnly = false,
}: {
  criteria: Criterion[];
  scaleMax: number;
  scoreMode?: "points" | "weighted";
  submitting?: boolean;
  onSubmit: (
    scores: Record<string, number>,
    feedback: string,
  ) => Promise<boolean>;
  defaultScores?: Record<string, number>;
  defaultFeedback?: string;
  readOnly?: boolean;
}) {
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
  const points = rubricUsesPointTotals({
    criteria,
    scaleMax,
    scoreMode: scoreMode ?? "points",
  });
  const complete = criteria.every(
    (c) =>
      Number.isInteger(scores[c.id]) &&
      scores[c.id] >= 0 &&
      scores[c.id] <= criterionMax(c, scaleMax),
  );
  const total = criteria.reduce((n, c) => n + (scores[c.id] ?? 0), 0);
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
            "Choose a score for every criterion. Zero is a valid score.",
          );
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {criteria.filter((c) => scores[c.id] !== undefined).length} /{" "}
          {criteria.length} criteria scored
        </span>
        {points && (
          <strong>
            {total} / {rubricTotalMax({ criteria, scaleMax })} points
          </strong>
        )}
        {dirty && <span className="text-amber-300">Unsaved changes</span>}
      </div>
      <fieldset disabled={readOnly || submitting} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {criteria.map((c) => {
            const max = criterionMax(c, scaleMax);
            const score = scores[c.id];
            return (
              <section
                key={c.id}
                className="rounded-xl border border-white/10 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{c.label}</h2>
                  <span className="shrink-0 text-sm text-slate-400">
                    / {max}
                    {!points && ` · ×${c.weight}`}
                  </span>
                </div>
                {c.description && (
                  <details>
                    <summary className="text-sm text-slate-400">
                      Scoring guide
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-300">
                      {c.description}
                    </p>
                  </details>
                )}
                {max > 10 ? (
                  <div className="space-y-2">
                    <input
                      aria-label={`${c.label} slider`}
                      type="range"
                      min={0}
                      max={max}
                      step={1}
                      value={score ?? 0}
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
                        min={0}
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
                    className="flex flex-wrap gap-2"
                  >
                    {Array.from({ length: max + 1 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={score === i}
                        aria-label={`${c.label}: ${i}`}
                        className={score === i ? "ux-primary" : "ux-secondary"}
                        onClick={() => setScores({ ...scores, [c.id]: i })}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                )}
                {score === undefined && (
                  <p className="text-xs text-slate-400">No score selected</p>
                )}
              </section>
            );
          })}
        </div>
        <label className="ux-label">
          Feedback{" "}
          <span className="text-xs text-slate-400">
            Optional · shared when organizers release feedback
          </span>
          <textarea
            className="ux-input"
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What worked well? What could improve?"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="ux-secondary"
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
          <button type="submit" className="ux-primary">
            {submitting
              ? "Saving…"
              : hasReview
                ? "Save review changes"
                : "Submit review"}
          </button>
        </div>
      </fieldset>
      <Status error={error} notice={!dirty ? notice : ""} />
    </form>
  );
}
