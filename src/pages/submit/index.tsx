"use client";

import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID, storage } from "@/lib/firebase";
import { deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useClientSession } from "@/lib/session";

type EventSettings = {
  lockSubmissions?: boolean;
  maxImages?: number;
};

type TeamDoc = {
  id: string;
  name?: string;
  teamCode?: string;
  github?: string;
  devpost?: string;
  description?: string;
  imageUrls?: string[];
};

function Page() {
  const { ready, session } = useClientSession();
  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [busy, setBusy] = useState(false);

  const [github, setGithub] = useState("");
  const [devpost, setDevpost] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (!ready) return;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(doc(db, "events", EVENT_ID), (sSnap) => {
        setSettings(sSnap.exists() ? (sSnap.data() as EventSettings) : {});
      })
    );

    if (session?.role === "team") {
      const tRef = doc(db, "events", EVENT_ID, "teams", session.teamId);
      unsubs.push(
        onSnapshot(tRef, (tSnap) => {
          if (!tSnap.exists()) {
            setTeam(null);
            return;
          }
          const data: TeamDoc = {
            id: tSnap.id,
            ...(tSnap.data() as Partial<TeamDoc>)
          };
          setTeam(data);
          setGithub(data.github || "");
          setDevpost(data.devpost || "");
          setDesc(data.description || "");
        })
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [ready, session]);

  async function handleUploadImages(
    teamId: string,
    teamCode: string
  ): Promise<string[]> {
    if (!files || !files.length) return [];
    const max = settings?.maxImages ?? 10;
    const limit = Math.min(files.length, max);
    const urls: string[] = [];
    for (let i = 0; i < limit; i++) {
      const f = files[i];
      const path = `events/${EVENT_ID}/teams/${teamId}/${Date.now()}_${i}_${
        f.name
      }`;
      const r = ref(storage, path);
      await uploadBytes(r, f, { customMetadata: { teamId, teamCode } });
      urls.push(await getDownloadURL(r));
    }
    return urls;
  }

  async function save() {
    if (!team) return;
    if (settings?.lockSubmissions) {
      alert("Submissions are locked.");
      return;
    }
    setBusy(true);
    try {
      const extra = await handleUploadImages(team.id, team.teamCode || "");
      const max = settings?.maxImages ?? 10;
      const imageUrls = [...(team.imageUrls || []), ...extra].slice(0, max);
      await updateDoc(doc(db, "events", EVENT_ID, "teams", team.id), {
        github,
        devpost,
        description: desc,
        imageUrls,
        teamCode: team.teamCode || "",
        techStack: deleteField()
      });
      setTeam((current) => {
        if (!current) return current;
        return {
          ...current,
          github,
          devpost,
          description: desc,
          imageUrls
        };
      });
      alert("Submission saved!");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error saving.");
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

          {settings?.lockSubmissions && (
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
                  Media Upload
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Max images: {settings?.maxImages ?? 10}
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(e.target.files)}
                  className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-900"
                />
              </div>

              <button
                disabled={busy || settings?.lockSubmissions}
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
                {settings?.lockSubmissions ? "Locked" : "Open"}
              </p>
            </div>
          </div>

          {!!team?.imageUrls?.length && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Uploaded Images
              </p>
              <div className="grid grid-cols-2 gap-2">
                {team.imageUrls.map((u: string, i: number) => (
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
