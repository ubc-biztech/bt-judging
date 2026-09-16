"use client";

import { useEffect, useState } from "react";
import { Status } from "@/components/Feedback";
import { validUrl } from "@/lib/ux";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import type { JudgingLink as Link } from "@ubc-biztech/sdk";
import {
  eventOrEmpty,
  setLinks as saveLinks,
  newLinkId,
  errorMessage,
} from "@/lib/bt";

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
  const [form, setForm] = useState({ label: "Schedule", url: "" });
  const [error, setError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setLinks((await eventOrEmpty()).links);
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function addLink() {
    if (busy) return;
    if (!form.label.trim() || !validUrl(form.url))
      return setError("Enter a label and a full URL starting with https://.");
    setBusy(true);
    try {
      const saved = await saveLinks((ls) => [
        ...ls,
        { id: newLinkId(), label: form.label.trim(), url: form.url.trim() },
      ]);
      setLinks(saved.links);
      setForm({ label: "", url: "" });
      setNotice("Link added.");
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(id: string) {
    if (busy || !confirm("Delete this event link?")) return;
    setBusy(true);
    try {
      const saved = await saveLinks((ls) => ls.filter((x) => x.id !== id));
      setLinks(saved.links);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Status loading={!error} error={error} onRetry={load} />;
  return (
    <fieldset disabled={busy} className="max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Links Manager
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Shared links appear in the navigation for signed-in participants.
      </p>

      <form
        data-unsaved={!!form.url}
        onSubmit={(e) => {
          e.preventDefault();
          void addLink();
        }}
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <input
          aria-label="Link label"
          required
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Label (Schedule, Discord, …)"
        />
        <input
          aria-label="Link URL"
          type="url"
          required
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="https://…"
        />
        <button type="submit" className="ux-primary">
          {busy ? "Saving…" : "Add link"}
        </button>
      </form>
      <Status error={error} notice={notice} />

      <ol className="mt-6 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        {links.map((l) => (
          <li key={l.id} className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-[1_1_16rem]">
              <p className="font-medium">{l.label}</p>
              <a
                className="mt-1 block text-sm text-[var(--blue)] underline [overflow-wrap:anywhere]"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                {l.url}
              </a>
            </div>
            <button
              className="ux-secondary !text-rose-600"
              onClick={() => removeLink(l.id)}
            >
              Delete
            </button>
          </li>
        ))}
        {!links.length && (
          <li className="p-4 text-sm text-[var(--ink-3)]">No links yet.</li>
        )}
      </ol>
    </fieldset>
  );
}
