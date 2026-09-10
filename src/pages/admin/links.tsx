"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query
} from "firebase/firestore";
import { getSession } from "@/lib/session";

type Team = { id: string; name: string };
type LinkDoc = {
  id: string;
  teamId: string;
  title: string;
  url: string;
  createdBy?: string;
};

export default function LinksPage() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [links, setLinks] = useState<LinkDoc[]>([]);
  const [form, setForm] = useState({ teamId: "", title: "Devpost", url: "" });
  const admin = getSession() as any;

  useEffect(() => {
    (async () => {
      const ts = await getDocs(
        query(collection(db, "events", EVENT_ID, "teams"), orderBy("name"))
      );
      setTeams(
        ts.docs.map((d) => ({ id: d.id, name: (d.data() as any).name }))
      );
      const ls = await getDocs(
        query(collection(db, "events", EVENT_ID, "links"))
      );
      setLinks(ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  async function addLink() {
    if (!form.teamId || !form.url) return alert("Team and URL required.");
    await addDoc(collection(db, "events", EVENT_ID, "links"), {
      teamId: form.teamId,
      title: form.title || "Link",
      url: form.url,
      createdBy: "admin",
      createdAt: new Date(),
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    setForm({ ...form, url: "" });
    const ls = await getDocs(
      query(collection(db, "events", EVENT_ID, "links"))
    );
    setLinks(ls.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }

  async function removeLink(id: string) {
    await deleteDoc(doc(db, "events", EVENT_ID, "links", id));
    setLinks((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Links Manager</h1>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <select
          value={form.teamId}
          onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
        >
          <option value="">Select team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Title (Devpost, Demo, …)"
        />
        <input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="https://…"
        />
        <button
          onClick={addLink}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Add
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Team</th>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr
                key={l.id}
                className="border-t border-gray-100 dark:border-white/10"
              >
                <td className="px-4 py-2">{teamMap[l.teamId] || l.teamId}</td>
                <td className="px-4 py-2">{l.title}</td>
                <td className="px-4 py-2">
                  <a
                    className="text-indigo-600 underline"
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.url}
                  </a>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => removeLink(l.id)}
                    className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td
                  className="px-4 py-4 text-gray-500 dark:text-gray-400"
                  colSpan={4}
                >
                  No links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
