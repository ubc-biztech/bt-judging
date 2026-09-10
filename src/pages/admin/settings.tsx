"use client";

import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { DEFAULT_EVENT_NAME } from "@/lib/event";
import { useEffect, useMemo, useState } from "react";
import { db, EVENT_ID } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

type Settings = {
  name?: string;
  requiredJudgeCount?: number;
  maxImages?: number;
  lockSubmissions?: boolean;
  showTeamFeedback?: boolean;
  allowJudgeSeeOthers?: boolean;
  anonymizeTeams?: boolean;
  phase?: "submission" | "judging" | "closed";
};

export default function AdminSettings() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const ref = useMemo(() => doc(db, "events", EVENT_ID), []);
  const [s, setS] = useState<Settings>({
    name: DEFAULT_EVENT_NAME,
    requiredJudgeCount: 3,
    maxImages: 10,
    lockSubmissions: false,
    showTeamFeedback: true,
    allowJudgeSeeOthers: true,
    anonymizeTeams: false,
    phase: "submission"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setS((prev) => ({ ...prev, ...(snap.data() as Settings) }));
      }
      setLoading(false);
    })();
  }, [ref]);

  async function save() {
    await setDoc(ref, s, { merge: true });
    alert("Settings saved");
  }

  if (loading) return null;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Event Settings</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Event name</label>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.name || ""}
            onChange={(e) => setS((v) => ({ ...v, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Phase</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.phase || "submission"}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                phase: e.target.value as Settings["phase"]
              }))
            }
          >
            <option value="submission">Submission</option>
            <option value="judging">Judging</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">
            Required judges per team
          </label>
          <input
            type="number"
            min={1}
            className="mt-1 w-32 rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.requiredJudgeCount || 1}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                requiredJudgeCount: Math.max(1, Number(e.target.value || 1))
              }))
            }
          />
        </div>
        <div>
          <label className="text-sm font-medium">Max images per team</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-32 rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.maxImages ?? 10}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                maxImages: Math.max(0, Number(e.target.value || 0))
              }))
            }
          />
        </div>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!s.lockSubmissions}
            onChange={(e) =>
              setS((v) => ({ ...v, lockSubmissions: e.target.checked }))
            }
          />
          Lock team submissions
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.showTeamFeedback !== false}
            onChange={(e) =>
              setS((v) => ({ ...v, showTeamFeedback: e.target.checked }))
            }
          />
          Teams can view own feedback
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!s.allowJudgeSeeOthers}
            onChange={(e) =>
              setS((v) => ({ ...v, allowJudgeSeeOthers: e.target.checked }))
            }
          />
          Judges can see others’ scores
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!s.anonymizeTeams}
            onChange={(e) =>
              setS((v) => ({ ...v, anonymizeTeams: e.target.checked }))
            }
          />
          Anonymize team names for judges
        </label>
      </div>

      <div className="mt-6">
        <button
          onClick={save}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Save settings
        </button>
      </div>
    </div>
  );
}
