"use client";
import { useEffect, useState } from "react";
import type { JudgingSettings as Settings } from "@ubc-biztech/sdk";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import EventBrand from "@/components/EventBrand";
import { Status } from "@/components/Feedback";
import {
  settingsOrDefaults,
  patchSettings,
  errorMessage,
  uploadEventImage,
} from "@/lib/bt";
const EDITABLE = [
  "eventName",
  "imageUrl",
  "perTeamJudges",
  "maxImages",
  "finalsTopN",
  "lockSubmissions",
  "showTeamFeedback",
  "allowJudgeSeeOthers",
  "anonymizeTeams",
] as const;
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
  const [saved, setSaved] = useState<Settings | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    try {
      const next = await settingsOrDefaults();
      setS(next);
      setSaved(next);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const dirty = !!s && !!saved && EDITABLE.some((key) => s[key] !== saved[key]);
  async function save() {
    if (!s || !saved || busy || uploading) return;
    if (!s.eventName.trim()) {
      setError("Enter an event name.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Only changed controls are patched; schedule and finals selections may have changed elsewhere.
      const patch = Object.fromEntries(
        EDITABLE.filter((key) => s[key] !== saved[key]).map((key) => [
          key,
          key === "eventName" ? s.eventName.trim() : s[key],
        ]),
      );
      const result = await patchSettings(patch);
      setS(result.settings);
      setSaved(result.settings);
      setNotice("Settings saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl" data-unsaved={dirty || uploading}>
      <h1 className="text-3xl font-semibold">Event Settings</h1>
      <Status
        error={error}
        notice={dirty ? "" : notice}
        loading={!s && !error}
        onRetry={!s ? load : undefined}
      />
      {s && (
        <>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!dirty || busy || uploading}
                className="ux-primary"
              >
                {busy ? "Saving…" : "Save settings"}
              </button>
              {dirty && (
                <>
                  <span className="text-sm text-amber-300">
                    Unsaved changes
                  </span>
                  <button
                    type="button"
                    disabled={busy || uploading}
                    className="ux-secondary"
                    onClick={() => {
                      setS(saved);
                      setError("");
                    }}
                  >
                    Discard
                  </button>
                </>
              )}
            </div>
            <fieldset disabled={busy || uploading} className="space-y-6">
              <label className="ux-label">
                Event name
                <input
                  className="ux-input"
                  required
                  value={s.eventName}
                  onChange={(e) => setS({ ...s, eventName: e.target.value })}
                />
              </label>
              <div className="space-y-3">
                <p className="ux-label">Event photo or logo</p>
                <EventBrand
                  name={s.eventName}
                  imageUrl={s.imageUrl}
                  className="h-24 w-48"
                />
                <label className="ux-label">
                  Upload image
                  <input
                    className="ux-input"
                    type="file"
                    aria-label="Upload image"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      if (!file) return;
                      setUploading(true);
                      setError("");
                      setNotice("");
                      try {
                        const imageUrl = await uploadEventImage(file);
                        setS((current) =>
                          current ? { ...current, imageUrl } : current,
                        );
                        setNotice(
                          "Image uploaded. Save settings to publish it.",
                        );
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  <span className="text-xs font-normal text-slate-400">
                    PNG, JPG or WebP, up to 5 MB. Save settings to publish.
                  </span>
                </label>
                {uploading && (
                  <p role="status" className="text-sm">
                    Uploading image…
                  </p>
                )}
                {s.imageUrl && (
                  <button
                    type="button"
                    className="ux-secondary"
                    onClick={() => setS({ ...s, imageUrl: "" })}
                  >
                    Remove image
                  </button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["perTeamJudges", "Judges per team", 1, 3],
                    ["maxImages", "Images per team", 0, 10],
                    ["finalsTopN", "Finalists to select", 1, 5],
                  ] as const
                ).map(([key, label, min, fallback]) => (
                  <label key={key} className="ux-label">
                    {label}
                    <input
                      type="number"
                      min={min}
                      step={1}
                      required
                      className="ux-input"
                      value={s[key] ?? fallback}
                      onChange={(e) =>
                        setS({ ...s, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="space-y-4">
                {(
                  [
                    [
                      "lockSubmissions",
                      "Lock team submissions",
                      "Overrides the submissions-open phase.",
                    ],
                    ["showTeamFeedback", "Show teams their feedback", ""],
                    [
                      "allowJudgeSeeOthers",
                      "Show judges other judges’ scores",
                      "",
                    ],
                    ["anonymizeTeams", "Hide team names from judges", ""],
                  ] as const
                ).map(([key, label, hint]) => (
                  <label key={key} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={s[key]}
                      onChange={(e) => setS({ ...s, [key]: e.target.checked })}
                    />
                    <span>
                      {label}
                      {hint && (
                        <span className="mt-1 block text-xs text-slate-400">
                          {hint}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        </>
      )}
    </div>
  );
}
