"use client";
import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { Status } from "@/components/Feedback";
import { normalizeRubric, rubricTotalMax } from "@/lib/judging";
import type { Rubric } from "@ubc-biztech/sdk";
import { loadEvent, setRubric as saveRubric, errorMessage } from "@/lib/bt";
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
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNew = useRef(false);
  useEffect(() => {
    if (focusNew.current) {
      inputs.current[(rubric?.criteria.length ?? 1) - 1]?.focus();
      focusNew.current = false;
    }
  }, [rubric?.criteria.length]);
  async function load() {
    setError("");
    try {
      const existing = (await loadEvent())?.rubric;
      const r = normalizeRubric(existing);
      setRubric(r);
      setSaved(existing ? JSON.stringify(r) : "");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
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
    setBusy(true);
    try {
      const d = await saveRubric(normalizeRubric(rubric));
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
        {rubric.criteria.length} criteria · {rubricTotalMax(rubric)} points
        total
      </p>
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
            className="rounded-xl border border-white/10 p-4 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <label className="ux-label">
                Criterion {i + 1}
                <input
                  className="ux-input"
                  required
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={c.label}
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
                rows={3}
                value={c.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>
            {rubric.scoreMode === "weighted" && (
              <label className="ux-label">
                Weight
                <input
                  className="ux-input"
                  type="number"
                  min={0.1}
                  step={0.1}
                  required
                  value={c.weight}
                  onChange={(e) =>
                    update(i, { weight: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <button
              type="button"
              className="text-sm text-rose-300"
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
