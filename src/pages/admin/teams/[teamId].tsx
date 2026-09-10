/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/admin/teams/[teamId].tsx
"use client";

import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { db, EVENT_ID, storage } from "@/lib/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  addDoc
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

type Team = {
  id: string;
  name: string;
  members: string[];
  teamCode?: string;
  github?: string;
  devpost?: string;
  description?: string;
  imageUrls?: string[];
  createdAt?: any;
  updatedAt?: any;
};

type Review = {
  id: string;
  teamId: string;
  judgeId: string;
  judgeName?: string;
  total: number;
  weightedTotal: number;
  round?: "prelim" | "finals";
  createdAt?: any;
  scores?: Record<string, number>;
  feedback?: string;
};

type Judge = {
  id: string;
  name?: string;
  code?: string;
  isAdmin?: boolean;
  assignedTeamIds?: string[];
};

type ExtLink = {
  id: string;
  teamId: string;
  title: string;
  url: string;
  createdAt?: any;
  createdBy?: string;
};

export default function AdminTeamDetail() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const router = useRouter();
  const { teamId } = router.query as { teamId: string };

  const [team, setTeam] = useState<Team | null>(null);
  const [edit, setEdit] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<any>(null);
  const [finalsSelected, setFinalsSelected] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [links, setLinks] = useState<ExtLink[]>([]);
  const [loading, setLoading] = useState(true);

  const [newLink, setNewLink] = useState<{ title: string; url: string }>({
    title: "",
    url: ""
  });

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      setLoading(true);

      // Event settings
      const s = await getDoc(doc(db, "events", EVENT_ID));
      const sData = s.exists() ? s.data() : {};
      setSettings(sData);
      setFinalsSelected((sData.finalsTeamIds || []).includes(teamId));

      // Team
      const t = await getDoc(doc(db, "events", EVENT_ID, "teams", teamId));
      if (t.exists()) {
        const data = { id: t.id, ...(t.data() as any) } as Team;
        setTeam(data);
        setEdit(data);
      }

      // Judges
      const js = await getDocs(collection(db, "events", EVENT_ID, "judges"));
      const jList: Judge[] = [];
      js.forEach((d) => jList.push({ id: d.id, ...(d.data() as any) }));
      setJudges(jList);

      // Reviews for this team (both rounds)
      const rq = query(
        collection(db, "events", EVENT_ID, "reviews"),
        where("teamId", "==", teamId)
      );
      const rs = await getDocs(rq);
      const list: Review[] = [];
      rs.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setReviews(list);

      // External links for this team
      const lq = query(
        collection(db, "events", EVENT_ID, "links"),
        where("teamId", "==", teamId)
      );
      const ls = await getDocs(lq);
      const items: ExtLink[] = [];
      ls.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      setLinks(items);

      setLoading(false);
    })();
  }, [teamId]);

  const prelim = useMemo(
    () => reviews.filter((r) => (r.round || "prelim") === "prelim"),
    [reviews]
  );
  const finals = useMemo(
    () => reviews.filter((r) => r.round === "finals"),
    [reviews]
  );

  const prelimAgg = useMemo(() => aggregate(prelim), [prelim]);
  const finalsAgg = useMemo(() => aggregate(finals), [finals]);

  const assignedJudges = useMemo(
    () =>
      judges.filter((j) => (j.assignedTeamIds || []).includes(teamId || "")),
    [judges, teamId]
  );
  const unassignedJudges = useMemo(
    () =>
      judges.filter((j) => !(j.assignedTeamIds || []).includes(teamId || "")),
    [judges, teamId]
  );

  async function saveEdits() {
    if (!edit) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "events", EVENT_ID, "teams", edit.id), {
        name: edit.name,
        members: edit.members || [],
        teamCode: edit.teamCode || "",
        github: edit.github || "",
        devpost: edit.devpost || "",
        description: edit.description || "",
        techStack: deleteField(),
        updatedAt: new Date()
      } as any);
      setTeam(edit);
      alert("Saved.");
    } catch (e: any) {
      alert(e.message || "Error saving.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFinals() {
    if (!settings || !team) return;
    const cur: string[] = settings.finalsTeamIds || [];
    const next = new Set(cur);
    if (next.has(team.id)) next.delete(team.id);
    else next.add(team.id);
    try {
      await updateDoc(doc(db, "events", EVENT_ID), {
        finalsTeamIds: Array.from(next)
      });
      setFinalsSelected(!finalsSelected);
      setSettings({ ...settings, finalsTeamIds: Array.from(next) });
    } catch (e: any) {
      alert(e.message || "Error updating finals selection.");
    }
  }

  async function deleteImagesByUrls(urls: string[]) {
    const deletions = urls.map(async (u) => {
      try {
        const r = ref(storage, u);
        await deleteObject(r);
      } catch (e) {
        console.warn("Failed to delete image", u, e);
      }
    });
    await Promise.allSettled(deletions);
  }

  async function clearSubmission() {
    if (!team) return;
    const confirmed = confirm(
      `Clear submission for "${team.name}"?\n\nThis will:\n• Delete uploaded images\n• Reset GitHub, Devpost, Description\n\nTeam name, members, and team code remain.`
    );
    if (!confirmed) return;

    try {
      const urls = team.imageUrls || [];
      if (urls.length) await deleteImagesByUrls(urls);

      await updateDoc(doc(db, "events", EVENT_ID, "teams", team.id), {
        github: "",
        devpost: "",
        description: "",
        imageUrls: [],
        techStack: deleteField(),
        updatedAt: new Date()
      } as any);

      const next: Team = {
        ...team,
        github: "",
        devpost: "",
        description: "",
        imageUrls: [],
        updatedAt: new Date() as any
      };
      setTeam(next);
      setEdit(next);

      alert("Submission cleared.");
    } catch (e: any) {
      alert(e.message || "Error clearing submission.");
    }
  }

  async function assignJudge(judgeId: string) {
    try {
      await updateDoc(doc(db, "events", EVENT_ID, "judges", judgeId), {
        assignedTeamIds: arrayUnion(teamId)
      });
      // local update
      setJudges((prev) =>
        prev.map((j) =>
          j.id === judgeId
            ? { ...j, assignedTeamIds: [...(j.assignedTeamIds || []), teamId!] }
            : j
        )
      );
    } catch (e: any) {
      alert(e.message || "Error assigning judge.");
    }
  }

  async function unassignJudge(judgeId: string) {
    try {
      await updateDoc(doc(db, "events", EVENT_ID, "judges", judgeId), {
        assignedTeamIds: arrayRemove(teamId)
      });
      setJudges((prev) =>
        prev.map((j) =>
          j.id === judgeId
            ? {
                ...j,
                assignedTeamIds: (j.assignedTeamIds || []).filter(
                  (t) => t !== teamId
                )
              }
            : j
        )
      );
    } catch (e: any) {
      alert(e.message || "Error unassigning judge.");
    }
  }

  async function addExternalLink() {
    if (!teamId) return;
    const title = newLink.title.trim();
    const url = newLink.url.trim();
    if (!title || !url) return alert("Title and URL required.");
    try {
      const nd = await addDoc(collection(db, "events", EVENT_ID, "links"), {
        teamId,
        title,
        url,
        createdAt: new Date(),
        createdBy: "admin"
      });
      setLinks((l) => [...l, { id: nd.id, teamId, title, url }]);
      setNewLink({ title: "", url: "" });
    } catch (e: any) {
      alert(e.message || "Error adding link.");
    }
  }

  async function removeExternalLink(id: string) {
    try {
      await deleteDoc(doc(db, "events", EVENT_ID, "links", id));
      setLinks((l) => l.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e.message || "Error removing link.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  if (!team || !edit) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            Back
          </button>
        </div>
        <div className="rounded-2xl border border-gray-200 p-4 text-sm text-rose-600 dark:border-white/10">
          Team not found.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Team: {team.name}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ID: <span className="font-mono">{team.id}</span>
            {team.createdAt?.toDate ? (
              <> • Created: {team.createdAt.toDate().toLocaleString()}</>
            ) : null}
            {team.updatedAt?.toDate ? (
              <> • Updated: {team.updatedAt.toDate().toLocaleString()}</>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            Admin Home
          </Link>
          <button
            onClick={() => router.back()}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Prelim Avg (weighted)" value={fmt(prelimAgg.avgW)} />
        <Stat label="Prelim Reviews" value={String(prelimAgg.count)} />
        <Stat label="Finals Avg (weighted)" value={fmt(finalsAgg.avgW)} />
        <Stat label="Finals Reviews" value={String(finalsAgg.count)} />
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <button
          onClick={() => copy(team.teamCode || "")}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Copy Team Code
        </button>
        {team.github ? (
          <a
            href={team.github}
            target="_blank"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            Open GitHub
          </a>
        ) : null}
        {team.devpost ? (
          <a
            href={team.devpost}
            target="_blank"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          >
            Open Devpost
          </a>
        ) : null}
        <Link
          href={`/judge/${team.id}`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Open Judge View (Prelim)
        </Link>
        <Link
          href={`/judge/finals/${team.id}`}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
        >
          Open Judge View (Finals)
        </Link>
        <button
          onClick={toggleFinals}
          className={[
            "rounded-lg px-3 py-2 text-xs font-semibold",
            finalsSelected
              ? "bg-rose-600 text-white"
              : "bg-indigo-600 text-white"
          ].join(" ")}
        >
          {finalsSelected ? "Remove from Finals" : "Add to Finals"}
        </button>
      </div>

      {/* Submission editor */}
      <section className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Submission</div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSubmission}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Clear submission
            </button>
            <button
              onClick={saveEdits}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Labeled label="Team Name">
              <input
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Labeled>

            <Labeled label="Members">
              <TagEditor
                values={edit.members || []}
                onChange={(v) => setEdit({ ...edit, members: v })}
                placeholder="Add member"
              />
            </Labeled>

            <Labeled label="Team Code">
              <input
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-mono dark:border-white/10 dark:bg-transparent"
                value={edit.teamCode || ""}
                onChange={(e) => setEdit({ ...edit, teamCode: e.target.value })}
              />
            </Labeled>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Labeled label="GitHub URL">
                <input
                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-white/10 dark:bg-transparent"
                  value={edit.github || ""}
                  onChange={(e) => setEdit({ ...edit, github: e.target.value })}
                />
              </Labeled>
              <Labeled label="Devpost URL">
                <input
                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs font-mono dark:border-white/10 dark:bg-transparent"
                  value={edit.devpost || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, devpost: e.target.value })
                  }
                />
              </Labeled>
            </div>
          </div>

          <div>
            <Labeled label="Description">
              <textarea
                rows={8}
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
                value={edit.description || ""}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </Labeled>
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        <div className="mb-3 text-lg font-semibold">Images</div>
        {team.imageUrls?.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {team.imageUrls!.map((u, i) => (
              <a
                key={i}
                href={u}
                target="_blank"
                className="block overflow-hidden rounded-lg border border-gray-200 dark:border-white/10"
                title="Open image"
              >
                <img
                  src={u}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No images uploaded.
          </div>
        )}
      </section>

      {/* External Links (Devpost / extras) */}
      <section className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        <div className="mb-3 text-lg font-semibold">Team Links</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {links.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-white/10"
            >
              <a href={l.url} target="_blank" className="truncate underline">
                {l.title}
              </a>
              <button
                onClick={() => removeExternalLink(l.id)}
                className="ml-3 rounded border border-gray-200 px-2 py-0.5 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
              >
                Remove
              </button>
            </div>
          ))}
          {links.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 sm:col-span-2 md:col-span-3">
              No links yet.
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
            placeholder="Title (e.g., Devpost)"
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
          />
          <input
            className="rounded-md border border-gray-200 px-2 py-1 text-sm font-mono dark:border-white/10 dark:bg-transparent"
            placeholder="https://…"
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
          />
          <button
            onClick={addExternalLink}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Add link
          </button>
        </div>
      </section>

      {/* Judges assignment */}
      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div className="mb-2 text-lg font-semibold">Assigned Judges</div>
          <div className="space-y-2">
            {assignedJudges.map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {j.name || j.id}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID: <span className="font-mono">{j.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => unassignJudge(j.id)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  Unassign
                </button>
              </div>
            ))}
            {assignedJudges.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No judges assigned.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div className="mb-2 text-lg font-semibold">Add Judges</div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {unassignedJudges.map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-white/10"
              >
                <div className="truncate">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {j.name || j.id}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID: <span className="font-mono">{j.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => assignJudge(j.id)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  Assign
                </button>
              </div>
            ))}
            {unassignedJudges.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                All judges already assigned.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Prelim Reviews</div>
            <AggPill
              label="Avg (weighted)"
              value={prelimAgg.avgW}
              count={prelimAgg.count}
            />
          </div>
          <ReviewsTable reviews={prelim} />
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Finals Reviews</div>
            <AggPill
              label="Avg (weighted)"
              value={finalsAgg.avgW}
              count={finalsAgg.count}
            />
          </div>
          <ReviewsTable reviews={finals} />
        </div>
      </section>
    </div>
  );
}

/* ---------- helpers & tiny components ---------- */

function Labeled({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </div>
      {children}
    </label>
  );
}

function TagEditor({
  values,
  onChange,
  placeholder
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v) return;
    onChange([...(values || []), v]);
    setInput("");
  }
  function remove(i: number) {
    const next = [...values];
    next.splice(i, 1);
    onChange(next);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(values || []).map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-white/10"
          >
            {v}
            <button
              className="text-gray-500 hover:text-rose-600"
              onClick={() => remove(i)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder={placeholder || "Add"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? add() : undefined)}
        />
        <button
          onClick={add}
          className="rounded-md border border-gray-200 px-2 text-xs dark:border-white/10"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ReviewsTable({ reviews }: { reviews: Review[] }) {
  const sorted = useMemo(
    () =>
      [...reviews].sort((a, b) => {
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      }),
    [reviews]
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            <th className="px-2 py-1 text-left">Judge</th>
            <th className="px-2 py-1 text-left">Round</th>
            <th className="px-2 py-1 text-left">Weighted</th>
            <th className="px-2 py-1 text-left">Raw</th>
            <th className="px-2 py-1 text-left">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="border-t border-gray-100 dark:border-white/10"
            >
              <td className="px-2 py-1">{r.judgeName || r.judgeId}</td>
              <td className="px-2 py-1">{r.round || "prelim"}</td>
              <td className="px-2 py-1">
                {Number(r.weightedTotal || 0).toFixed(2)}
              </td>
              <td className="px-2 py-1">{Number(r.total || 0).toFixed(2)}</td>
              <td className="px-2 py-1">
                {r.createdAt?.toDate
                  ? r.createdAt.toDate().toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                className="px-2 py-2 text-gray-500 dark:text-gray-400"
                colSpan={5}
              >
                No reviews yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AggPill({
  label,
  value,
  count
}: {
  label: string;
  value: number;
  count: number;
}) {
  const v = isFinite(value) ? value.toFixed(2) : "—";
  return (
    <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-700 dark:bg-white/5 dark:text-gray-300">
      {label}: <span className="font-medium">{v}</span> ({count})
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-white/10">
      <div className="text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function aggregate(list: Review[]) {
  const n = list.length || 0;
  if (!n) return { avgW: 0, avg: 0, count: 0 };
  const sumW = list.reduce((a, r) => a + Number(r.weightedTotal || 0), 0);
  const sum = list.reduce((a, r) => a + Number(r.total || 0), 0);
  return { avgW: sumW / n, avg: sum / n, count: n };
}

function copy(s: string) {
  if (!s) return alert("No team code.");
  navigator.clipboard.writeText(s).then(
    () => alert("Copied team code"),
    () => alert("Copy failed")
  );
}

function fmt(n: number) {
  return isFinite(n) ? n.toFixed(2) : "—";
}
