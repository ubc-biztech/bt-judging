"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { Status } from "@/components/Feedback";
import { normalizeRubric, rubricTotalMax } from "@/lib/judging";
import { isProductPlus } from "@/lib/event";
import {
  PRODUCT_PLUS_RUBRIC,
  scaleProductRubric,
} from "@/lib/product-plus";
import { scoringGuide } from "@/lib/scoring-guide";
import ScoringGuide from "@/components/ScoringGuide";
import type { Rubric } from "@ubc-biztech/sdk";
import {
  loadEvent,
  setRubric as saveRubric,
  listReviews,
  errorMessage,
} from "@/lib/bt";
export default function RubricPage() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}
function Page() {
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const product = isProductPlus();
  const [hasReviews, setHasReviews] = useState(false);
  const [judgingStarted, setJudgingStarted] = useState(false);
  const scoringLocked = product && (hasReviews || judgingStarted);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNew = useRef(false);
  useEffect(() => {
    if (focusNew.current) {
      inputs.current[(rubric?.criteria.length ?? 1) - 1]?.focus();
      focusNew.current = false;
    }
  }, [rubric?.criteria.length]);
  const load = useCallback(async () => {
    setError("");
    try {
      const [doc, reviews] = await Promise.all([
        loadEvent(),
        product ? listReviews() : Promise.resolve([]),
      ]);
      const existing = doc?.rubric;
      const r =
        product && !existing
          ? scaleProductRubric(PRODUCT_PLUS_RUBRIC)
          : normalizeRubric(existing);
      setHasReviews(reviews.length > 0);
      setJudgingStarted(!!doc && doc.settings.phase !== "submission");
      setRubric(r);
      setSaved(existing ? JSON.stringify(r) : "");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [product]);
  useEffect(() => {
    void load();
  }, [load]);
  const dirty = !!rubric && JSON.stringify(rubric) !== saved;
  async function save() {
    if (!rubric || busy) return;
    setNotice("");
    setError("");
    if (
      !rubric.name.trim() ||
      !rubric.criteria.length ||
      rubric.criteria.some((c) => !c.label.trim())
    ) {
      setError("Name the rubric and include at least one named criterion.");
      return;
    }
    if (
      product &&
      rubric.criteria.some(
        (c) => scoringGuide(c.description).bands.length !== 4,
      )
    ) {
      setError(
        "Include a guide for all four bands on each criterion: 1–3, 4–6, 7–8, and 9–10.",
      );
      return;
    }
    setBusy(true);
    try {
      const d = await saveRubric(
        product ? scaleProductRubric(rubric) : normalizeRubric(rubric),
      );
      const r = normalizeRubric(d.rubric);
      setRubric(r);
      setSaved(JSON.stringify(r));
      setNotice("Rubric saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!rubric) return <Status loading={!error} error={error} onRetry={load} />;
  const update = (i: number, patch: Partial<Rubric["criteria"][number]>) =>
    setRubric({
      ...rubric,
      criteria: rubric.criteria.map((c, n) =>
        n === i ? { ...c, ...patch } : c,
      ),
    });
  return (
    <form
      data-unsaved={dirty}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="max-w-4xl space-y-5"
    >
      <h1 className="text-3xl font-semibold">Rubric</h1>
      <p className="text-sm text-[var(--ink-3)]">
        {rubric.criteria.length} criteria ·{" "}
        {product
          ? "Each out of 10 · Weighted total out of 100"
          : `${rubricTotalMax(rubric)} points total`}
      </p>
      {scoringLocked && (
        <p role="status" className="text-sm text-[var(--ink-3)]">
          Scoring is locked. Guidance remains editable.
        </p>
      )}
      <fieldset disabled={busy} className="space-y-5">
        <label className="ux-label">
          Rubric name
          <input
            className="ux-input"
            required
            value={rubric.name}
            onChange={(e) => setRubric({ ...rubric, name: e.target.value })}
          />
        </label>
        {rubric.criteria.map((c, i) => (
          <section
            key={c.id}
            className="border-t border-[var(--line)] pt-6 space-y-4"
          >
            <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="ux-label">
                Criterion {i + 1}
                <input
                  className="ux-input"
                  required
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={c.label}
                  disabled={scoringLocked}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label className="ux-label">
                Maximum score
                <input
                  className="ux-input"
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={c.maxScore ?? rubric.scaleMax}
                  readOnly={product}
                  onChange={(e) =>
                    update(i, { maxScore: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="ux-label">
              Scoring guide
              <textarea
                className="ux-input"
                rows={product ? 9 : 3}
                value={c.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>
            {product && (
              <details>
                <summary className="text-sm underline">
                  Preview judge guidance
                </summary>
                <div className="mt-4">
                  <ScoringGuide description={c.description} />
                </div>
              </details>
            )}
            {rubric.scoreMode === "weighted" && (
              <label className="ux-label sm:max-w-60">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  Relative weight
                  {product && (
                    <span className="text-xs text-[var(--ink-3)]">
                      {(
                        (c.weight /
                          rubric.criteria.reduce(
                            (n, item) => n + item.weight,
                            0,
                          )) *
                        100
                      ).toFixed(1)}
                      % of total
                    </span>
                  )}
                </span>
                <input
                  className="ux-input"
                  type="number"
                  min={0.01}
                  step="any"
                  disabled={scoringLocked}
                  required
                  value={Number(c.weight.toPrecision(6))}
                  onChange={(e) =>
                    update(i, { weight: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <button
              type="button"
              disabled={scoringLocked}
              className="text-sm text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                if (confirm(`Remove “${c.label}” from the rubric?`))
                  setRubric({
                    ...rubric,
                    criteria: rubric.criteria.filter((_, n) => n !== i),
                  });
              }}
            >
              Remove criterion
            </button>
          </section>
        ))}
        <button
          type="button"
          className="ux-secondary"
          disabled={scoringLocked}
          onClick={() => {
            focusNew.current = true;
            setRubric({
              ...rubric,
              criteria: [
                ...rubric.criteria,
                {
                  id: crypto.randomUUID().slice(0, 8),
                  label: "",
                  description: "",
                  weight: 1,
                  maxScore: rubric.scaleMax,
                },
              ],
            });
          }}
        >
          Add criterion
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="ux-primary" disabled={!dirty}>
            {busy ? "Saving…" : "Save rubric"}
          </button>
          {dirty && (
            <>
              <span className="text-sm text-amber-300">Unsaved changes</span>
              <button
                type="button"
                className="ux-secondary"
                onClick={() => {
                  if (confirm("Discard changes and reload?")) void load();
                }}
              >
                Discard
              </button>
            </>
          )}
        </div>
      </fieldset>
      <Status error={error} notice={!dirty ? notice : ""} />
    </form>
  );
}
