"use client";

import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import type { JudgingSettingsSetInput as Settings } from "@ubc-biztech/sdk";
import type { Phase } from "@/lib/types";
import { judging, errorMessage, settingsOrDefaults, DEFAULT_SETTINGS, PHASES } from "@/lib/bt";

const PHASE_LABELS: Record<Phase, string> = {
  submission: "Submission",
  prelim: "Preliminary judging",
  finals: "Finals",
  closed: "Closed",
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
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { updatedAt: _u, ...current } = await settingsOrDefaults();
        setS(current);
      } catch (e) {
        setError(errorMessage(e));
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setError(null);
    try {
      const { updatedAt: _u, ...saved } = await judging().settings.set(s);
      setS(saved);
      alert("Settings saved");
    } catch (e) {
      setError(errorMessage(e));
    }
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
            value={s.eventName}
            onChange={(e) => setS((v) => ({ ...v, eventName: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Phase</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.phase}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                phase: e.target.value as Phase
              }))
            }
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
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
            value={s.perTeamJudges || 1}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                perTeamJudges: Math.max(1, Number(e.target.value || 1))
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
            value={s.maxImages}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                maxImages: Math.max(0, Number(e.target.value || 0))
              }))
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Finalists (top N)</label>
          <input
            type="number"
            min={1}
            className="mt-1 w-32 rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
            value={s.finalsTopN}
            onChange={(e) =>
              setS((v) => ({
                ...v,
                finalsTopN: Math.max(1, Number(e.target.value || 1))
              }))
            }
          />
        </div>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.lockSubmissions}
            onChange={(e) =>
              setS((v) => ({ ...v, lockSubmissions: e.target.checked }))
            }
          />
          Lock team submissions
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.showTeamFeedback}
            onChange={(e) =>
              setS((v) => ({ ...v, showTeamFeedback: e.target.checked }))
            }
          />
          Teams can view own feedback
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.allowJudgeSeeOthers}
            onChange={(e) =>
              setS((v) => ({ ...v, allowJudgeSeeOthers: e.target.checked }))
            }
          />
          Judges can see others’ scores
        </label>

        <label className="mt-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.anonymizeTeams}
            onChange={(e) =>
              setS((v) => ({ ...v, anonymizeTeams: e.target.checked }))
            }
          />
          Anonymize team names for judges
        </label>
      </div>

      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}

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
