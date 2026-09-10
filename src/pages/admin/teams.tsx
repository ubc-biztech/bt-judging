"use client";

import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { getSession } from "@/lib/session";
import Link from "next/link";

type Team = {
  id: string;
  name: string;
  members: string[];
  teamCode?: string;
  github?: string;
  devpost?: string;
  description?: string;
};

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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", members: "", teamCode: "" });
  const admin = getSession();
  const adminCode = admin?.role === "admin" ? admin.adminCode : "ADMIN";

  async function load() {
    setLoading(true);
    const qt = query(
      collection(db, "events", EVENT_ID, "teams"),
      orderBy("name")
    );
    const snap = await getDocs(qt);
    setList(
      snap.docs.map((d) => {
        const data = d.data() as Partial<Team>;
        return {
          id: d.id,
          name: data.name || "",
          members: Array.isArray(data.members) ? data.members : [],
          teamCode: data.teamCode || "",
          github: data.github || "",
          devpost: data.devpost || "",
          description: data.description || ""
        };
      })
    );
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createTeam() {
    if (!form.name) return alert("Team name required");
    await addDoc(collection(db, "events", EVENT_ID, "teams"), {
      name: form.name,
      members: form.members
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      github: "",
      devpost: "",
      description: "",
      teamCode: form.teamCode || "",
      imageUrls: [],
      createdAt: serverTimestamp(),
      _adminJudgeId: "admin",
      _adminJudgeCode: adminCode
    });
    setForm({ name: "", members: "", teamCode: "" });
    await load();
  }

  async function saveTeam(t: Team) {
    await updateDoc(doc(db, "events", EVENT_ID, "teams", t.id), {
      name: t.name,
      members: t.members,
      teamCode: t.teamCode || "",
      github: t.github || "",
      devpost: t.devpost || "",
      description: t.description || "",
      techStack: deleteField(),
      _adminJudgeId: "admin",
      _adminJudgeCode: adminCode
    });
    await load();
  }

  async function removeTeam(t: Team) {
    if (!confirm(`Delete team "${t.name}"?`)) return;
    await deleteDoc(doc(db, "events", EVENT_ID, "teams", t.id));
    await load();
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
          csvCell(team.teamCode || ""),
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
            Add a team name, members, and an optional access code.
          </p>
        </div>
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
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Team Code (optional)"
            value={form.teamCode}
            onChange={(e) => setForm({ ...form, teamCode: e.target.value })}
          />
          <button
            onClick={createTeam}
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            Create
          </button>
        </div>
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
          className="w-36 rounded-md border border-gray-200 px-2 py-1 text-sm font-mono dark:border-white/10 dark:bg-transparent"
          value={edit.teamCode || ""}
          onChange={(e) => setEdit({ ...edit, teamCode: e.target.value })}
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
