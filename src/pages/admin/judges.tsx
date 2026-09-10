// pages/admin/judges.tsx
"use client";

import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import {
  createJudge as apiCreateJudge,
  deleteJudge,
  errorMessage,
  listJudges,
  updateJudge
} from "@/lib/data";
import type { Judge } from "@/lib/types";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newJ, setNewJ] = useState({ name: "", isAdmin: false });
  // The most recently created judge: its code is shown once, prominently, so it can be handed over.
  const [created, setCreated] = useState<Judge | null>(null);

  async function load() {
    setLoading(true);
    try {
      setList(await listJudges());
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
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    await load();
  }

  async function createJudge() {
    if (!newJ.name) return alert("Name required");
    await run(async () => {
      const j = await apiCreateJudge(newJ.name, newJ.isAdmin);
      setCreated(j);
      setNewJ({ name: "", isAdmin: false });
    });
  }

  async function saveJudge(j: Judge) {
    await run(() => updateJudge(j.id, { name: j.name, isAdmin: j.isAdmin }));
  }

  async function resetAssignments(j: Judge) {
    await run(() => updateJudge(j.id, { assignedTeamIds: [] }));
  }

  async function removeJudge(j: Judge) {
    if (!confirm(`Delete judge "${j.name}"?`)) return;
    await run(() => deleteJudge(j.id));
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Judges</h1>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-50">Create Judge</div>
            <p className="mt-1 text-sm text-slate-400">
              Add a judge by name. An access code is generated for them.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Name"
            value={newJ.name}
            onChange={(e) => setNewJ({ ...newJ, name: e.target.value })}
          />
          <label className="inline-flex h-11 shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-[#0f1012] px-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={newJ.isAdmin}
              onChange={(e) => setNewJ({ ...newJ, isAdmin: e.target.checked })}
              className="size-4 rounded border-white/20 bg-transparent text-white"
            />
            Admin
          </label>
          <button
            onClick={createJudge}
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            Create
          </button>
        </div>
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
              onClick={() => navigator.clipboard?.writeText(created.code ?? "")}
            >
              Copy
            </button>
          </div>
        )}
        {error && <div className="mt-4 text-sm text-rose-300">{error}</div>}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Admin</th>
              <th className="px-4 py-2 text-left">Assigned</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-4" colSpan={5}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              list.map((j) => (
                <Row
                  key={j.id}
                  j={j}
                  onSave={saveJudge}
                  onReset={resetAssignments}
                  onDelete={removeJudge}
                />
              ))}
            {!loading && list.length === 0 && (
              <tr>
                <td
                  className="px-4 py-4 text-gray-500 dark:text-gray-400"
                  colSpan={5}
                >
                  No judges yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  j,
  onSave,
  onReset,
  onDelete
}: {
  j: Judge;
  onSave: (j: Judge) => Promise<void>;
  onReset: (j: Judge) => Promise<void>;
  onDelete: (j: Judge) => Promise<void>;
}) {
  const [edit, setEdit] = useState(j);
  return (
    <tr className="border-t border-gray-100 dark:border-white/10">
      <td className="px-4 py-2">
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <span className="font-mono text-sm tracking-wider">{j.code ?? "••••"}</span>
      </td>
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={edit.isAdmin}
          onChange={(e) => setEdit({ ...edit, isAdmin: e.target.checked })}
        />
      </td>
      <td className="px-4 py-2">{edit.assignedTeamIds.length}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs dark:border-white/10"
            onClick={() => onReset(edit)}
          >
            Reset
          </button>
          <button
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs dark:border-white/10"
            onClick={() => onSave(edit)}
          >
            Save
          </button>
          <button
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
            onClick={() => onDelete(edit)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default dynamic(() => Promise.resolve(AdminJudgesInner), { ssr: false });
