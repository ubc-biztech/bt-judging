"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { judging, errorMessage, eventOrEmpty } from "@/lib/bt";

function Page() {
  const { ready, session } = useClientSession();
  const [busy, setBusy] = useState(false);

  const [github, setGithub] = useState("");
  const [devpost, setDevpost] = useState("");
  const [desc, setDesc] = useState("");
  // Images are URLs now (uploads went with Firebase Storage). One per line.
  const [imageText, setImageText] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const teamId = session?.role === "team" ? session.id : undefined;
  // One document: settings and this team's entry, as the team code may see it.
  const docPoll = usePoll(ready && teamId ? eventOrEmpty : null, [teamId], 10000);
  const settings = docPoll.data?.settings ?? null;
  const team = docPoll.data?.teams.find((t) => t.id === teamId) ?? null;

  // Seed the form once per team load, so polling does not clobber edits in progress.
  useEffect(() => {
    if (!team || loadedFor === team.id) return;
    setGithub(team.github || "");
    setDevpost(team.devpost || "");
    setDesc(team.description || "");
    setImageText((team.imageUrls || []).join("\n"));
    setLoadedFor(team.id);
  }, [team, loadedFor]);

  const closed = !!settings && (settings.lockSubmissions || settings.phase !== "submission");

  async function save() {
    if (!team) return;
    if (closed) {
      alert("Submissions are locked.");
      return;
    }
    setBusy(true);
    try {
      const max = settings?.maxImages ?? 10;
      const imageUrls = imageText
        .split(/\r?\n/)
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, max);
      await judging().team(team.id).update({
        name: team.name,
        members: team.members,
        github,
        devpost,
        description: desc,
        imageUrls,
      });
      setImageText(imageUrls.join("\n"));
      await docPoll.refresh();
      alert("Submission saved!");
    } catch (e: unknown) {
      alert(errorMessage(e) || "Error saving.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="grid max-w-5xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            Team Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">
            Team Submission
          </h1>
          <p className="mt-3 text-sm text-slate-400">Edit links, summary, and images.</p>

          {closed && (
            <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Submissions are currently locked.
            </p>
          )}

          {!ready && (
            <div className="mt-4 text-sm text-slate-400">Loading…</div>
          )}

          {ready && !team && (
            <div className="mt-4 text-sm text-slate-400">Loading your team…</div>
          )}

          {team && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0c1324]/70 p-3 text-sm text-slate-300">
                Team: <span className="font-semibold text-slate-100">{team.name}</span>
              </div>

              <input
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="GitHub URL"
              />
              <input
                value={devpost}
                onChange={(e) => setDevpost(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Devpost URL"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Description"
              />

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Image URLs
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  One link per line (host them anywhere public). Max images: {settings?.maxImages ?? 10}
                </div>
                <textarea
                  value={imageText}
                  onChange={(e) => setImageText(e.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder={"https://…/screenshot-1.png\nhttps://…/screenshot-2.png"}
                />
              </div>

              <button
                disabled={busy || closed}
                onClick={save}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save Submission"}
              </button>
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-white/10 bg-[#0b1221]/70 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Submission Status
          </h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Team
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {team?.name || "Loading"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Current Images
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {team?.imageUrls?.length || 0} / {settings?.maxImages ?? 10}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Submission Lock
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {closed ? "Locked" : "Open"}
              </p>
            </div>
          </div>

          {!!team?.imageUrls?.length && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Current Images
              </p>
              <div className="grid grid-cols-2 gap-2">
                {team.imageUrls.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt=""
                    className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Layout>
  );
}

export default function Submit() {
  return (
    <RoleGate allow={["team"]}>
      <Page />
    </RoleGate>
  );
}
