"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { createLink, deleteLink, errorMessage, listLinks } from "@/lib/data";
import type { Link } from "@/lib/types";

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
  const [links, setLinks] = useState<Link[]>([]);
  const [form, setForm] = useState({ label: "Schedule", url: "", order: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLinks(await listLinks());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function addLink() {
    if (!form.label || !form.url) return alert("Label and URL required.");
    try {
      await createLink(form.label, form.url, form.order === "" ? undefined : Number(form.order));
      setForm({ ...form, url: "", order: "" });
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    await load();
  }

  async function removeLink(id: string) {
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Links Manager</h1>
      <p className="mt-2 text-sm text-slate-400">
        Event-wide links shown on the home page (schedule, Discord, rules). Team links live on each team.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Label (Schedule, Discord, …)"
        />
        <input
          type="number"
          value={form.order}
          onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Order (optional)"
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
      {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Order</th>
              <th className="px-4 py-2 text-left">Label</th>
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
                <td className="px-4 py-2">{l.order}</td>
                <td className="px-4 py-2">{l.label}</td>
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
