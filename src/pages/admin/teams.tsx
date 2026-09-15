"use client";

import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import { EVENT_ID } from "@/lib/event";
import Link from "next/link";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, setTeams, errorMessage } from "@/lib/bt";
import { TEAM_CODE_PRESETS, normalizeCode, presetTeamCodes, type TeamCodePreset } from "@/lib/codes";

export default function AdminTeams() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [list, setList] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [preset, setPreset] = useState<TeamCodePreset>("name");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", members: "" });
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState<Team | null>(null);

  async function load() {
    setLoading(true);
    try {
      const doc = await eventOrEmpty();
      setList(doc.teams);
      setJudges(doc.judges);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createTeam() {
    if (!form.name) return alert("Team name required");
    setError("");
    try {
      // A team without an id is new: the server assigns the id and mints the login code.
      const before = new Set(list.map((t) => t.id));
      const doc = await setTeams((teams) => [
        ...teams,
        {
          name: form.name,
          members: form.members
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          imageUrls: []
        }
      ]);
      setLastCreated(doc.teams.find((t) => !before.has(t.id)) ?? null);
      setForm({ name: "", members: "" });
      setList(doc.teams);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function applyPreset() {
    if (!confirm(`Replace every team's code using "${TEAM_CODE_PRESETS.find((p) => p.id === preset)?.label}"? Teams will need the new code to sign in.`)) return;
    setError("");
    try {
      const doc = await setTeams((teams) => presetTeamCodes(teams, judges.map((j) => j.code ?? ""), preset));
      setList(doc.teams);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function saveTeam(t: Team) {
    setError("");
    const code = normalizeCode(t.code ?? "");
    const clash = [...list.filter((x) => x.id !== t.id), ...judges].some((x) => x.code && normalizeCode(x.code) === code);
    if (code && clash) return setError(`Code ${code} is already used by another team or judge.`);
    try {
      // Organizers edit teams by rewriting the event document; id and code are kept.
      const doc = await setTeams((teams) =>
        teams.map((x) =>
          x.id === t.id
            ? {
                ...x,
                name: t.name,
                code: code || x.code,
                members: t.members,
                github: t.github || undefined,
                devpost: t.devpost || undefined,
                description: t.description || undefined,
                imageUrls: t.imageUrls || []
              }
            : x
        )
      );
      setList(doc.teams);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function removeTeam(t: Team) {
    if (!confirm(`Delete team "${t.name}"? Its reviews stay on the server but are no longer shown.`)) return;
    setError("");
    try {
      const doc = await setTeams((teams) => teams.filter((x) => x.id !== t.id));
      setList(doc.teams);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function exportTeamsCsv() {
    const csvCell = (value: unknown) => {
      const s = value == null ? "" : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Team Name", "Team Code", "Team ID", "Members"];
    const lines = [header.map(csvCell).join(",")];

    list.forEach((team) => {
      lines.push(
        [
          csvCell(team.name || ""),
          csvCell(team.code || ""),
          csvCell(team.id),
          csvCell((team.members || []).join(", "))
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${EVENT_ID}-teams-codes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Teams</h1>
        <button
          onClick={exportTeamsCsv}
          disabled={loading || list.length === 0}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Export Teams + Codes
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div>
          <div className="text-lg font-semibold text-slate-50">Create Team</div>
          <p className="mt-1 text-sm text-slate-400">
            Add a team name and members. A login code is generated for the team.
          </p>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {lastCreated && (
          <div className="mt-3 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            Created “{lastCreated.name}”. Login code:{" "}
            <span className="font-mono font-semibold">{lastCreated.code}</span>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Team Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="h-11 min-w-0 flex-[1.2] rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Members (comma-separated)"
            value={form.members}
            onChange={(e) => setForm({ ...form, members: e.target.value })}
          />
          <button
            onClick={createTeam}
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            Create
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mr-auto">
          <div className="text-sm font-semibold text-slate-50">Presets</div>
          <p className="mt-0.5 text-xs text-slate-400">{TEAM_CODE_PRESETS.find((p) => p.id === preset)?.hint}</p>
        </div>
        <select
          className="h-9 rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100"
          value={preset}
          onChange={(e) => setPreset(e.target.value as TeamCodePreset)}
        >
          {TEAM_CODE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button onClick={applyPreset} disabled={list.length === 0} className="h-9 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-50">
          Apply to all teams
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Members</th>
              <th className="px-4 py-2 text-left">Team Code</th>
              <th className="px-4 py-2 text-left">Links</th>
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
              list.map((t) => (
                <EditableTeamRow
                  key={t.id}
                  t={t}
                  onSave={saveTeam}
                  onDelete={removeTeam}
                />
              ))}
            {!loading && list.length === 0 && (
              <tr>
                <td
                  className="px-4 py-4 text-gray-500 dark:text-gray-400"
                  colSpan={5}
                >
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableTeamRow({
  t,
  onSave,
  onDelete
}: {
  t: Team;
  onSave: (t: Team) => Promise<void>;
  onDelete: (t: Team) => Promise<void>;
}) {
  const [edit, setEdit] = useState<Team>({ ...t });
  const [member, setMember] = useState("");
  useEffect(() => setEdit({ ...t }), [t]);

  function addMember() {
    const m = member.trim();
    if (!m) return;
    setEdit((e) => ({ ...e, members: [...(e.members || []), m] }));
    setMember("");
  }
  function removeMember(i: number) {
    setEdit((e) => ({
      ...e,
      members: e.members.filter((_, idx) => idx !== i)
    }));
  }

  return (
    <tr className="align-top border-t border-gray-100 dark:border-white/10">
      <td className="px-4 py-3">
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {(edit.members || []).map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-white/10"
            >
              {m}
              <button
                className="text-gray-500 hover:text-rose-600"
                onClick={() => removeMember(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
            placeholder="Add member"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          />
          <button
            onClick={addMember}
            className="rounded-md border border-gray-200 px-2 text-xs dark:border-white/10"
          >
            Add
          </button>
        </div>
      </td>

      <td className="px-4 py-3">
        <input
          className="w-40 rounded-md border border-gray-200 px-2 py-1 font-mono text-sm tracking-wider dark:border-white/10 dark:bg-transparent"
          value={edit.code ?? ""}
          onChange={(e) => setEdit({ ...edit, code: e.target.value })}
          onBlur={(e) => setEdit({ ...edit, code: normalizeCode(e.target.value) })}
        />
      </td>

      <td className="px-4 py-3">
        <div className="grid gap-2">
          <input
            className="w-56 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-white/10 dark:bg-transparent"
            placeholder="GitHub URL"
            value={edit.github || ""}
            onChange={(e) => setEdit({ ...edit, github: e.target.value })}
          />
          <input
            className="w-56 rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-white/10 dark:bg-transparent"
            placeholder="Devpost URL"
            value={edit.devpost || ""}
            onChange={(e) => setEdit({ ...edit, devpost: e.target.value })}
          />
          <textarea
            className="w-56 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
            placeholder="Description"
            rows={3}
            value={edit.description || ""}
            onChange={(e) => setEdit({ ...edit, description: e.target.value })}
          />
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <Link
            href={`/admin/teams/${t.id}`}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-center dark:border-white/10"
          >
            View
          </Link>
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
