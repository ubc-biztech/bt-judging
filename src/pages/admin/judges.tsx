// pages/admin/judges.tsx
"use client";

import { CopyButton, Status } from "@/components/Feedback";
import { withoutJudge } from "@/lib/ux";
import { excludeFromBlock } from "@/lib/schedule";
import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import type { Judge, JudgingTeam } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, setJudges, errorMessage } from "@/lib/bt";
import {
  CODE_PRESETS,
  normalizeCode,
  presetCodes,
  type CodePreset,
} from "@/lib/codes";

function AdminJudgesInner() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [list, setList] = useState<Judge[]>([]);
  const [teams, setTeams] = useState<JudgingTeam[]>([]);
  const [preset, setPreset] = useState<CodePreset>("first");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newJ, setNewJ] = useState({ name: "" });
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  // The most recently created judge: its code is shown once, prominently, so it can be handed over.
  const [created, setCreated] = useState<Judge | null>(null);

  async function load() {
    try {
      const doc = await eventOrEmpty();
      setLoaded(true);
      setList(doc.judges);
      setTeams(doc.teams);
      setCreated((current) =>
        current ? (doc.judges.find((j) => j.id === current.id) ?? null) : null,
      );
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await fn();
      setError(null);
      await load();
      setNotice("Changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function createJudge() {
    if (creating) return;
    const name = newJ.name.trim();
    if (!name) return setError("Name required");
    setCreating(true);
    try {
      await run(async () => {
        const before = new Set<string | undefined>();
        const saved = await saveEvent((doc) => {
          doc.judges.forEach((j) => before.add(j.id));
          const taken = [...doc.judges, ...doc.teams].map((x) => x.code ?? "");
          const additions = presetCodes(
            [{ name, assignedTeamIds: [] }],
            taken,
            preset,
          );
          return { ...doc, judges: [...doc.judges, ...additions] };
        });
        setCreated(saved.judges.find((x) => !before.has(x.id)) ?? null);
        setCopiedCode(null);
        setNewJ({ name: "" });
      });
    } finally {
      setCreating(false);
    }
  }

  async function copyCode() {
    if (!created?.code) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopiedCode(created.code);
      setError(null);
    } catch {
      setCopiedCode(null);
      setError("Could not copy the code. Select and copy it manually.");
    }
  }

  async function saveJudge(j: Judge) {
    if (!j.name.trim()) return setError("Enter a judge name.");
    const code = normalizeCode(j.code ?? "");
    const clash = [...list.filter((x) => x.id !== j.id), ...teams].some(
      (x) => x.code && normalizeCode(x.code) === code,
    );
    if (code && clash)
      return setError(`Code ${code} is already used by another judge or team.`);
    await run(() =>
      setJudges((js) =>
        js.map((x) =>
          x.id === j.id
            ? { ...x, name: j.name.trim(), code: code || x.code }
            : x,
        ),
      ),
    );
  }

  async function applyPreset() {
    if (document.querySelector('[data-editable-record][data-unsaved="true"]'))
      return setError("Save or discard row edits before replacing all codes.");
    if (
      !confirm(
        `Replace every judge's code using "${CODE_PRESETS.find((p) => p.id === preset)?.label}"? Judges will need the new code to sign in.`,
      )
    )
      return;
    await run(() =>
      saveEvent((d) => ({
        ...d,
        judges: presetCodes(
          d.judges,
          d.teams.map((t) => t.code ?? ""),
          preset,
        ),
      })),
    );
  }

  async function resetAssignments(j: Judge) {
    if (
      !confirm(
        `Reset all assignments for ${j.name}? Their saved reviews will remain.`,
      )
    )
      return;
    await run(() =>
      saveEvent((d) => {
        const s = d.settings.schedule;
        return {
          ...d,
          judges: d.judges.map((x) =>
            x.id === j.id ? { ...x, assignedTeamIds: [] } : x,
          ),
          settings: {
            ...d.settings,
            ...(s?.blocks.length
              ? { schedule: excludeFromBlock(s, j.id, s.blocks[0].id) }
              : {}),
          },
        };
      }),
    );
  }

  async function removeJudge(j: Judge) {
    if (!confirm(`Delete judge "${j.name}"?`)) return;
    await run(() => saveEvent((d) => withoutJudge(d, j.id)));
  }

  if (!loaded) return <Status loading={loading} error={error} onRetry={load} />;
  return (
    <fieldset disabled={busy} className="max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Judges
      </h1>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-50">
              Create Judge
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Add a judge by name. Their access code uses the selected preset.
            </p>
          </div>
        </div>
        <form
          data-unsaved={!!newJ.name}
          className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void createJudge();
          }}
        >
          <input
            className="h-11 min-w-0 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none xl:flex-1"
            placeholder="Name"
            aria-label="Judge name"
            required
            disabled={creating}
            value={newJ.name}
            onChange={(e) => setNewJ({ ...newJ, name: e.target.value })}
          />
          <button
            type="submit"
            disabled={creating || loading}
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
        {created && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <span>
              Code for <span className="font-semibold">{created.name}</span>:
            </span>
            <code className="rounded bg-black/40 px-2 py-1 font-mono text-base tracking-wider">
              {created.code}
            </code>
            <button
              className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs"
              onClick={copyCode}
              aria-live="polite"
            >
              {copiedCode === created.code ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        <Status error={error} notice={notice} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mr-auto">
          <div className="text-sm font-semibold text-slate-50">Presets</div>
          <p className="mt-0.5 text-xs text-slate-400">
            {CODE_PRESETS.find((p) => p.id === preset)?.hint}
          </p>
        </div>
        <select
          className="min-h-10 max-w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100"
          value={preset}
          aria-label="Judge code preset"
          disabled={creating}
          onChange={(e) => setPreset(e.target.value as CodePreset)}
        >
          {CODE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={applyPreset}
          disabled={list.length === 0}
          className="min-h-10 max-w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          Apply to all judges
        </button>
      </div>

      <section
        aria-label="Judges"
        className="mt-6 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      >
        {list.map((j) => (
          <Row
            key={j.id}
            j={j}
            onSave={saveJudge}
            onReset={resetAssignments}
            onDelete={removeJudge}
          />
        ))}
        {!list.length && (
          <p className="p-5 text-sm text-[var(--ink-3)]">No judges yet.</p>
        )}
      </section>
    </fieldset>
  );
}

function Row({
  j,
  onSave,
  onReset,
  onDelete,
}: {
  j: Judge;
  onSave: (j: Judge) => Promise<void>;
  onReset: (j: Judge) => Promise<void>;
  onDelete: (j: Judge) => Promise<void>;
}) {
  const [edit, setEdit] = useState(j);
  const seed = JSON.stringify([j.name, j.code]);
  useEffect(() => {
    setEdit(j);
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = edit.name !== j.name || edit.code !== j.code;
  return (
    <article
      data-editable-record
      data-unsaved={dirty}
      aria-label={j.name}
      className="min-w-0 space-y-4 p-4 sm:p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="ux-label">
          Judge name
          <input
            className="ux-input"
            aria-label={`Name for ${j.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onSave(edit);
              }
            }}
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />
        </label>
        <label className="ux-label">
          Access code
          <input
            className="ux-input font-mono"
            aria-label={`Code for ${j.name}`}
            value={edit.code ?? ""}
            onChange={(e) => setEdit({ ...edit, code: e.target.value })}
            onBlur={(e) =>
              setEdit({ ...edit, code: normalizeCode(e.target.value) })
            }
          />
        </label>
      </div>
      <p className="text-sm text-[var(--ink-3)]">
        Assigned teams: {j.assignedTeamIds?.length ?? 0}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="ux-primary"
          disabled={!dirty}
          onClick={() => onSave(edit)}
        >
          Save Changes
        </button>
        {dirty && (
          <button className="ux-secondary" onClick={() => setEdit(j)}>
            Discard
          </button>
        )}
        <CopyButton value={j.code ?? ""} label="Copy code" />
        <button className="ux-secondary" onClick={() => onReset(edit)}>
          Reset Assignments
        </button>
        <button
          className="ux-secondary !text-rose-600 sm:ml-auto"
          onClick={() => onDelete(edit)}
        >
          Delete judge
        </button>
      </div>
    </article>
  );
}

export default dynamic(() => Promise.resolve(AdminJudgesInner), { ssr: false });
