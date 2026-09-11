"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { JudgingTeam as Team } from "@ubc-biztech/sdk";
import { judging, login, errorMessage } from "@/lib/bt";

const RAW_TEAMS: { name: string; members: string[] }[] = [];

type PlanRow = {
  name: string;
  members: string[];
  existsName: boolean;
};

type ResultRow = {
  name: string;
  status: "created" | "error";
  detail: string;
};

export default function SeedTeamsPage() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<Team[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setExisting(await judging().teams.list());
      } catch (e) {
        setResult(`Error loading existing teams: ${errorMessage(e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const plan: PlanRow[] = useMemo(() => {
    const existingNames = new Set(existing.map((t) => t.name.trim().toLowerCase()));
    return RAW_TEAMS.map((t) => {
      const members = (t.members || []).map((m) => (m || "").trim()).filter(Boolean);
      return {
        name: t.name,
        members,
        existsName: existingNames.has(t.name.trim().toLowerCase())
      };
    });
  }, [existing]);

  async function createTeams() {
    setResult(null);
    setRows([]);
    setLoading(true);
    try {
      if (dryRun) {
        setResult(`Dry run complete. ${plan.length} teams would be created (no writes).`);
        return;
      }
      // No batch on the API: one create per row, reported per row. Server assigns id and code.
      const out: ResultRow[] = [];
      for (let i = 0; i < plan.length; i++) {
        const row = plan[i];
        setProgress(`Creating ${i + 1} of ${plan.length}: ${row.name}`);
        try {
          const t = await judging().teams.create({ name: row.name, members: row.members, imageUrls: [] });
          out.push({ name: row.name, status: "created", detail: t.code ?? "(code hidden)" });
        } catch (e) {
          out.push({ name: row.name, status: "error", detail: errorMessage(e) });
        }
        setRows([...out]);
      }
      const created = out.filter((r) => r.status === "created").length;
      setResult(`Created ${created} of ${plan.length} teams.${created < plan.length ? " See errors below." : ""}`);
      setExisting(await judging().teams.list());
    } catch (e) {
      setResult(`Error: ${errorMessage(e)}`);
    } finally {
      setProgress(null);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Seed Teams
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (no writes)
          </label>
          <button
            onClick={createTeams}
            disabled={loading || plan.length === 0}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Working…" : dryRun ? "Simulate Create" : "Create Teams"}
          </button>
        </div>
      </div>

      {plan.length === 0 && (
        <div className="mb-6 rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 dark:border-white/15 dark:text-gray-400">
          No seed data is configured. Add teams to `RAW_TEAMS` in this page or
          replace this tool with an importer.
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Members</th>
              <th className="px-3 py-2 text-left">Already exists?</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className="border-t border-gray-100 dark:border-white/10"
              >
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                  {r.members.join(", ")}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.existsName ? "A team with this name exists" : ""}
                </td>
              </tr>
            ))}
            {plan.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-gray-500 dark:text-gray-400"
                >
                  No teams to seed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {progress && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">{progress}</div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-gray-200 p-3 text-sm dark:border-white/10">
          {result}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Login code / error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-t border-gray-100 dark:border-white/10">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className={`px-3 py-2 font-mono ${r.status === "error" ? "text-rose-300" : ""}`}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Team ids and login codes are assigned by the server. Codes are shown once
        here and remain visible to admins on the Teams page.
      </p>
    </div>
  );
}
