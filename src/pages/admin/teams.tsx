"use client";

import { CopyButton, Status } from "@/components/Feedback";
import { submissionError, withoutTeam } from "@/lib/ux";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import { EVENT_ID } from "@/lib/event";
import Link from "next/link";
import type { Judge, JudgingTeam as Team } from "@ubc-biztech/sdk";
import { eventOrEmpty, saveEvent, setTeams, errorMessage } from "@/lib/bt";
import {
  TEAM_CODE_PRESETS,
  normalizeCode,
  presetTeamCodes,
  type TeamCodePreset,
} from "@/lib/codes";

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
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", members: "" });
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState<Team | null>(null);

  async function load() {
    try {
      const doc = await eventOrEmpty();
      setLoaded(true);
      setError("");
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
    if (busy) return;
    if (!form.name.trim()) return setError("Enter a team name.");
    setBusy(true);
    setError("");
    try {
      const before = new Set<string | undefined>();
      const doc = await saveEvent((d) => {
        d.teams.forEach((t) => before.add(t.id));
        const additions = presetTeamCodes(
          [
            {
              name: form.name.trim(),
              members: form.members
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              imageUrls: [],
            },
          ],
          [...d.teams, ...d.judges].map((t) => t.code ?? ""),
          preset,
        );
        return { ...d, teams: [...d.teams, ...additions] };
      });
      setLastCreated(doc.teams.find((t) => !before.has(t.id)) ?? null);
      setForm({ name: "", members: "" });
      setList(doc.teams);
      setLastCreated((current) =>
        current ? (doc.teams.find((t) => t.id === current.id) ?? null) : null,
      );
      setNotice("Changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyPreset() {
    if (document.querySelector('[data-editable-record][data-unsaved="true"]'))
      return setError("Save or discard row edits before replacing all codes.");
    if (
      !confirm(
        `Replace every team's code using "${TEAM_CODE_PRESETS.find((p) => p.id === preset)?.label}"? Teams will need the new code to sign in.`,
      )
    )
      return;
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const doc = await saveEvent((d) => ({
        ...d,
        teams: presetTeamCodes(
          d.teams,
          d.judges.map((j) => j.code ?? ""),
          preset,
        ),
      }));
      setList(doc.teams);
      setLastCreated((current) =>
        current ? (doc.teams.find((t) => t.id === current.id) ?? null) : null,
      );
      setNotice("Changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTeam(t: Team) {
    if (busy) return;
    if (!t.name.trim()) return setError("Enter a team name.");
    const invalid = submissionError(
      t.github ?? "",
      t.devpost ?? "",
      t.imageUrls ?? [],
      Infinity,
    );
    if (invalid) return setError(invalid);
    setError("");
    const code = normalizeCode(t.code ?? "");
    const clash = [...list.filter((x) => x.id !== t.id), ...judges].some(
      (x) => x.code && normalizeCode(x.code) === code,
    );
    if (code && clash)
      return setError(`Code ${code} is already used by another team or judge.`);
    setBusy(true);
    try {
      // Organizers edit teams by rewriting the event document; id and code are kept.
      const doc = await setTeams((teams) =>
        teams.map((x) =>
          x.id === t.id
            ? {
                ...x,
                name: t.name.trim(),
                code: code || x.code,
                members: t.members,
                github: t.github || undefined,
                devpost: t.devpost || undefined,
                description: t.description || undefined,
                imageUrls: t.imageUrls || [],
              }
            : x,
        ),
      );
      setList(doc.teams);
      setLastCreated((current) =>
        current ? (doc.teams.find((t) => t.id === current.id) ?? null) : null,
      );
      setNotice("Changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTeam(t: Team) {
    if (
      !confirm(
        `Delete team "${t.name}"? Its reviews stay on the server but are no longer shown.`,
      )
    )
      return;
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const doc = await saveEvent((d) => withoutTeam(d, t.id));
      setList(doc.teams);
      setLastCreated((current) =>
        current ? (doc.teams.find((t) => t.id === current.id) ?? null) : null,
      );
      setNotice("Changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
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
          csvCell((team.members || []).join(", ")),
        ].join(","),
      );
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${EVENT_ID}-teams-codes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return <Status loading={loading} error={error} onRetry={load} />;
  return (
    <fieldset disabled={busy} className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Teams
        </h1>
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
            Access codes use the selected preset.
          </p>
        </div>
        <Status error={error} notice={notice} />
        {lastCreated && (
          <div className="mt-3 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            Created “{lastCreated.name}”. Login code:{" "}
            <span className="font-mono font-semibold">{lastCreated.code}</span>{" "}
            <CopyButton value={lastCreated.code ?? ""} />
          </div>
        )}
        <form
          data-unsaved={!!form.name || !!form.members}
          onSubmit={(e) => {
            e.preventDefault();
            void createTeam();
          }}
          className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center"
        >
          <input
            className="min-h-11 w-full min-w-0 xl:flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            aria-label="Team name"
            required
            placeholder="Team Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="min-h-11 w-full min-w-0 xl:flex-[1.2] rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            aria-label="Members (comma-separated)"
            placeholder="Members (comma-separated)"
            value={form.members}
            onChange={(e) => setForm({ ...form, members: e.target.value })}
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            {busy ? "Saving…" : "Create"}
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="mr-auto">
          <div className="text-sm font-semibold text-slate-50">Presets</div>
          <p className="mt-0.5 text-xs text-slate-400">
            {TEAM_CODE_PRESETS.find((p) => p.id === preset)?.hint}
          </p>
        </div>
        <select
          className="min-h-10 max-w-full rounded-lg border border-white/10 bg-[#0b0b0c] px-3 text-sm text-slate-100"
          aria-label="Team code preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value as TeamCodePreset)}
        >
          {TEAM_CODE_PRESETS.map((p) => (
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
          Apply to all teams
        </button>
      </div>

      <section
        aria-label="Teams"
        className="mt-6 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      >
        {list.map((t) => (
          <EditableTeamRow
            key={t.id}
            t={t}
            onSave={saveTeam}
            onDelete={removeTeam}
          />
        ))}
        {!list.length && (
          <p className="p-5 text-sm text-[var(--ink-3)]">No teams yet.</p>
        )}
      </section>
    </fieldset>
  );
}

function EditableTeamRow({
  t,
  onSave,
  onDelete,
}: {
  t: Team;
  onSave: (t: Team) => Promise<void>;
  onDelete: (t: Team) => Promise<void>;
}) {
  const [edit, setEdit] = useState<Team>({ ...t });
  const [member, setMember] = useState("");
  const seed = JSON.stringify(t);
  useEffect(() => {
    setEdit({ ...t });
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(edit) !== JSON.stringify(t) || !!member;

  function addMember() {
    const m = member.trim();
    if (!m) return;
    setEdit((e) => ({ ...e, members: [...(e.members || []), m] }));
    setMember("");
  }
  function removeMember(i: number) {
    setEdit((e) => ({
      ...e,
      members: e.members.filter((_, idx) => idx !== i),
    }));
  }

  return (
    <article
      data-editable-record
      data-unsaved={dirty}
      aria-label={t.name}
      className="min-w-0 space-y-4 p-4 sm:p-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="ux-label">
          Team name
          <input
            className="ux-input"
            aria-label={`Name for ${t.name}`}
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />
        </label>
        <label className="ux-label">
          Access code
          <input
            className="ux-input font-mono"
            aria-label={`Code for ${t.name}`}
            value={edit.code ?? ""}
            onChange={(e) => setEdit({ ...edit, code: e.target.value })}
            onBlur={(e) =>
              setEdit({ ...edit, code: normalizeCode(e.target.value) })
            }
          />
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Members</p>
        <div className="flex flex-wrap gap-2">
          {(edit.members || []).map((m, i) => (
            <span
              key={i}
              className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--line)] pl-3 text-sm"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{m}</span>
              <button
                className="min-h-10 min-w-10 shrink-0 text-[var(--ink-3)] hover:text-rose-600"
                aria-label={`Remove ${m}`}
                onClick={() => removeMember(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="ux-input !w-auto min-w-0 flex-[1_1_12rem]"
            aria-label={`Add member to ${t.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMember();
              }
            }}
            placeholder="Member name"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          />
          <button
            className="ux-secondary"
            disabled={!member.trim()}
            onClick={addMember}
          >
            Add member
          </button>
        </div>
      </div>
      <details className="rounded-lg border border-[var(--line)] p-3">
        <summary className="text-sm font-medium">
          Project links & description
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="ux-label">
            GitHub URL
            <input
              className="ux-input"
              aria-label={`GitHub for ${t.name}`}
              placeholder="https://github.com/…"
              value={edit.github || ""}
              onChange={(e) => setEdit({ ...edit, github: e.target.value })}
            />
          </label>
          <label className="ux-label">
            Devpost URL
            <input
              className="ux-input"
              aria-label={`Devpost for ${t.name}`}
              placeholder="https://devpost.com/…"
              value={edit.devpost || ""}
              onChange={(e) => setEdit({ ...edit, devpost: e.target.value })}
            />
          </label>
          <label className="ux-label md:col-span-2">
            Description
            <textarea
              className="ux-input resize-y"
              aria-label={`Description for ${t.name}`}
              rows={3}
              value={edit.description || ""}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </label>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="ux-primary"
          disabled={!dirty}
          onClick={() => {
            const m = member.trim();
            void onSave(m ? { ...edit, members: [...edit.members, m] } : edit);
            if (m) {
              setEdit({ ...edit, members: [...edit.members, m] });
              setMember("");
            }
          }}
        >
          Save Changes
        </button>
        {dirty && (
          <button
            className="ux-secondary"
            onClick={() => {
              setEdit(t);
              setMember("");
            }}
          >
            Discard
          </button>
        )}
        <Link href={`/admin/teams/${t.id}`} className="ux-secondary">
          View team
        </Link>
        <CopyButton value={t.code ?? ""} label="Copy code" />
        <button
          className="ux-secondary !text-rose-600 sm:ml-auto"
          onClick={() => onDelete(edit)}
        >
          Delete team
        </button>
      </div>
    </article>
  );
}
