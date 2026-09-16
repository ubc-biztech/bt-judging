import { useState } from "react";
import Link from "next/link";
import type { JudgingEvent, JudgingSettings } from "@ubc-biztech/sdk";
import { errorMessage, saveEvent } from "@/lib/bt";
import {
  PHASE_ACTIONS,
  PHASE_HELP,
  PHASE_LABELS,
  phaseBlocker,
} from "@/lib/ux";
import { Status } from "./Feedback";

export default function PhaseControl({
  doc,
  onChange,
}: {
  doc: JudgingEvent;
  onChange: (doc: JudgingEvent) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phase = doc.settings.phase;
  async function change(next: JudgingSettings["phase"]) {
    if (busy) return;
    const blocker = phaseBlocker(doc, next);
    if (blocker) {
      setError(blocker);
      return;
    }
    if (!confirm(`${PHASE_ACTIONS[next]}? ${PHASE_HELP[next]}`)) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveEvent((current) => {
        if (current.settings.phase !== phase)
          throw new Error(
            "The phase changed in another session. Refresh before changing it again.",
          );
        const issue = phaseBlocker(current, next);
        if (issue) throw new Error(issue);
        return { ...current, settings: { ...current.settings, phase: next } };
      });
      onChange(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="phase"
      className="rounded-xl border border-cyan-300/30 bg-white/[0.03] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Event phase
          </p>
          <h2 className="mt-1 text-xl font-semibold">{PHASE_LABELS[phase]}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {phase === "submission" && doc.settings.lockSubmissions
              ? "Team submissions are locked in Event Settings. Judges cannot score yet."
              : PHASE_HELP[phase]}
          </p>
        </div>
        {phase === "submission" && (
          <button
            disabled={busy}
            className="ux-primary"
            onClick={() => change("prelim")}
          >
            {busy ? "Starting…" : "Start preliminary judging"}
          </button>
        )}
        {phase === "prelim" && (
          <Link className="ux-primary" href="/admin/finals">
            Prepare finals
          </Link>
        )}
        {phase === "finals" && (
          <button
            disabled={busy}
            className="ux-primary"
            onClick={() => change("closed")}
          >
            {busy ? "Closing…" : "Close judging"}
          </button>
        )}
        {phase === "closed" && !doc.settings.showTeamFeedback && (
          <Link className="ux-primary" href="/admin/settings#feedback-release">
            Release team feedback →
          </Link>
        )}
      </div>
      {phase === "closed" && (
        <p className="mt-3 text-sm">
          {doc.settings.showTeamFeedback
            ? "Teams can view their feedback."
            : "Team feedback is still hidden."}
        </p>
      )}
      <ol
        aria-label="Event phases"
        className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
      >
        {Object.entries(PHASE_LABELS).map(([key, label]) => (
          <li
            key={key}
            aria-current={key === phase ? "step" : undefined}
            className={`border-t-2 pt-2 ${key === phase ? "border-blue-500 font-semibold text-blue-600" : "border-gray-200 text-slate-400"}`}
          >
            {label}
          </li>
        ))}
      </ol>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-400">
          Other phase controls
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(PHASE_LABELS)
            .filter((p) => p !== phase)
            .map((p) => (
              <button
                key={p}
                disabled={busy}
                className="ux-secondary"
                onClick={() => change(p as JudgingSettings["phase"])}
              >
                {PHASE_ACTIONS[p as JudgingSettings["phase"]]}
              </button>
            ))}
        </div>
      </details>
      <Status error={error} />
    </section>
  );
}
