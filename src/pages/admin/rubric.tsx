"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  normalizeRubric
} from "@/lib/judging";
import { Criterion, Rubric } from "@/lib/types";
import { doc, getDoc, setDoc } from "firebase/firestore";

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
  const [rubric, setRubric] = useState<Rubric>(normalizeRubric());
  const [loading, setLoading] = useState(true);
  const ref = useMemo(
    () => doc(db, "events", EVENT_ID, "rubric", "default"),
    []
  );

  useEffect(() => {
    (async () => {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setRubric(normalizeRubric(snap.data() as Partial<Rubric>));
      } else {
        setRubric(normalizeRubric());
      }
      setLoading(false);
    })();
  }, [ref]);

  function addCrit() {
    setRubric((r) => ({
      ...r,
      criteria: [
        ...r.criteria,
        {
          id: crypto.randomUUID().slice(0, 8),
          label: "New criterion",
          description: "",
          weight: 1,
          maxScore: r.scaleMax
        }
      ]
    }));
  }
  function updateCrit(i: number, patch: Partial<Criterion>) {
    setRubric((r) => {
      const arr = r.criteria.slice();
      arr[i] = { ...arr[i], ...patch };
      return { ...r, criteria: arr };
    });
  }
  function removeCrit(i: number) {
    setRubric((r) => ({
      ...r,
      criteria: r.criteria.filter((_, idx) => idx !== i)
    }));
  }
  async function save() {
    const normalized = normalizeRubric(rubric);
    await setDoc(ref, normalized, { merge: true });
    setRubric(normalized);
    alert("Rubric saved");
  }

  if (loading) return null;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Rubric</h1>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <label className="text-sm font-medium text-slate-200">Name</label>
            <input
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
              value={rubric.name}
              onChange={(e) => setRubric((r) => ({ ...r, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-200">Default max score</label>
            <input
              type="number"
              min={1}
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 focus:border-white/20 focus:outline-none"
              value={rubric.scaleMax}
              onChange={(e) =>
                setRubric((r) => ({
                  ...r,
                  scaleMax: Math.max(1, Math.round(Number(e.target.value || 1)))
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-slate-50">Criteria</div>
            <p className="mt-1 text-sm text-slate-400">
              Define the categories judges will score against.
            </p>
          </div>
          <button
            onClick={addCrit}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
          >
            Add Criterion
          </button>
        </div>

        <div className="space-y-3">
          {rubric.criteria.map((c, i) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_9rem_10rem_minmax(0,1fr)_auto]">
                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Label
                  </label>
                  <input
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100 focus:border-white/20 focus:outline-none"
                    value={c.label}
                    onChange={(e) => updateCrit(i, { label: e.target.value })}
                  />
                  <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 py-2 text-sm text-slate-100 focus:border-white/20 focus:outline-none"
                    value={c.description || ""}
                    onChange={(e) =>
                      updateCrit(i, { description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Weight
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step="0.1"
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100 focus:border-white/20 focus:outline-none"
                    value={c.weight}
                    onChange={(e) =>
                      updateCrit(i, { weight: Number(e.target.value || 1) })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Max Score
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100 focus:border-white/20 focus:outline-none"
                    value={c.maxScore ?? rubric.scaleMax}
                    onChange={(e) =>
                      updateCrit(i, {
                        maxScore: Math.max(1, Math.round(Number(e.target.value || 1)))
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    ID
                  </label>
                  <input
                    disabled
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-xs font-mono text-slate-500 opacity-80"
                    value={c.id}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => removeCrit(i)}
                    className="h-10 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/15"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {rubric.criteria.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm text-slate-400">
              No criteria yet. Add your first scoring category.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={save}
          className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-slate-200"
        >
          Save Rubric
        </button>
      </div>
    </div>
  );
}
