"use client";

import TableScroll from "@/components/TableScroll";
import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { Status } from "@/components/Feedback";
import type { JudgingEvent, Review } from "@ubc-biztech/sdk";
import { eventOrEmpty, listReviews, errorMessage, saveEvent } from "@/lib/bt";
import { PHASE_LABELS, phaseBlocker } from "@/lib/ux";

export default function FinalsAdminPage() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}
function Page() {
  const [doc, setDoc] = useState<JudgingEvent | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [judges, setJudges] = useState<string[]>([]);
  const [topN, setTopN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setError("");
    try {
      const [d, r] = await Promise.all([
        eventOrEmpty(),
        listReviews({ round: "prelim" }),
      ]);
      setDoc(d);
      setReviews(r);
      setTeams(d.settings.finalsTeamIds);
      setJudges(d.settings.finalsJudgeIds);
      setTopN(d.settings.finalsTopN ?? 5);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const dirty =
    !!doc &&
    JSON.stringify([teams, judges, topN]) !==
      JSON.stringify([
        doc.settings.finalsTeamIds,
        doc.settings.finalsJudgeIds,
        doc.settings.finalsTopN,
      ]);
  const ranked = (doc?.teams ?? [])
    .map((t) => {
      const rs = reviews.filter((r) => r.teamId === t.id);
      return {
        ...t,
        count: rs.length,
        avg: rs.reduce((n, r) => n + r.weightedTotal, 0) / (rs.length || 1),
      };
    })
    .sort((a, b) => b.avg - a.avg);
  const toggle = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  async function save(start = false) {
    if (!doc || busy) return;
    setError("");
    setNotice("");
    if (!teams.length || !judges.length) {
      setError("Select at least one finalist and one finals judge.");
      return;
    }
    if (!Number.isInteger(topN) || topN < 1) {
      setError("Top teams must be a positive whole number.");
      return;
    }
    if (
      start &&
      !confirm(
        "Start finals? Preliminary scoring will close and finals judges can begin.",
      )
    )
      return;
    setBusy(true);
    try {
      const saved = await saveEvent((d) => {
        if (d.settings.phase !== doc.settings.phase)
          throw new Error(
            "The phase changed elsewhere. Reload before starting finals.",
          );
        if (
          teams.some((id) => !d.teams.some((t) => t.id === id)) ||
          judges.some((id) => !d.judges.some((j) => j.id === id))
        )
          throw new Error(
            "A selected team or judge was removed. Reload the setup.",
          );
        const next = {
          ...d,
          settings: {
            ...d.settings,
            finalsTopN: topN,
            finalsTeamIds: teams,
            finalsJudgeIds: judges,
            ...(start ? { phase: "finals" as const } : {}),
          },
        };
        const blocker = start && phaseBlocker(next, "finals");
        if (blocker) throw new Error(blocker);
        return next;
      });
      setDoc(saved);
      setNotice(start ? "Finals started." : "Finals setup saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (!doc) return <Status loading={!error} error={error} onRetry={load} />;
  return (
    <fieldset
      disabled={busy}
      data-unsaved={dirty}
      className="max-w-5xl space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Finals setup</h1>
        <Link href="/admin#phase" className="underline text-sm">
          {PHASE_LABELS[doc.settings.phase]} →
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="ux-primary"
          onClick={() => save(doc.settings.phase !== "finals")}
        >
          {busy
            ? "Saving…"
            : doc.settings.phase === "finals"
              ? "Save finals setup"
              : "Save & start finals"}
        </button>
        {doc.settings.phase !== "finals" && (
          <button className="ux-secondary" onClick={() => save()}>
            Save setup only
          </button>
        )}
        {dirty && (
          <>
            <span className="text-sm text-amber-300">Unsaved changes</span>
            <button
              className="ux-secondary"
              onClick={() => {
                if (confirm("Discard changes and reload?")) void load();
              }}
            >
              Discard
            </button>
          </>
        )}
      </div>
      <Status error={error} notice={!dirty ? notice : ""} />
      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="mb-3 font-semibold">
          Finals judges · {judges.length} selected
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {doc.judges.map((j) => (
            <label key={j.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={judges.includes(j.id)}
                onChange={() => setJudges(toggle(judges, j.id))}
              />
              {j.name}
            </label>
          ))}
        </div>
        {!doc.judges.length && (
          <Link href="/admin/judges" className="underline">
            Add judges
          </Link>
        )}
      </section>
      <section className="rounded-xl border border-white/10 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Finalists · {teams.length} selected</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label>
              Top{" "}
              <input
                aria-label="Number of top teams"
                className="ux-input !w-16"
                type="number"
                min={1}
                step={1}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
              />
            </label>
            <button
              className="ux-secondary"
              disabled={!ranked.some((t) => t.count)}
              onClick={() => {
                const reviewed = ranked.filter((t) => t.count);
                const n = Math.max(1, topN);
                setTeams(reviewed.slice(0, n).map((t) => t.id));
                setNotice(
                  reviewed[n - 1] &&
                    reviewed[n] &&
                    reviewed[n - 1].avg === reviewed[n].avg
                    ? "There is a tie at the cutoff. Check the selected finalists."
                    : "Selection updated. Check review coverage before starting finals.",
                );
              }}
            >
              Select top teams
            </button>
          </div>
        </div>
        {dirty && notice && (
          <p role="status" className="mb-3 text-sm text-amber-300">
            {notice}
          </p>
        )}
        <p className="mb-3 text-sm text-slate-400">
          Compare review counts before selecting finalists. Teams without
          reviews are not selected automatically.
        </p>
        <TableScroll label="Finalist comparison">
          <table className="min-w-[32rem] w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Finalist</th>
                <th className="p-2">Team</th>
                <th className="p-2">Prelim average</th>
                <th className="p-2">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((t) => (
                <tr key={t.id} className="border-t border-white/10">
                  <td className="p-2">
                    <input
                      aria-label={`Select ${t.name} for finals`}
                      type="checkbox"
                      checked={teams.includes(t.id)}
                      onChange={() => setTeams(toggle(teams, t.id))}
                    />
                  </td>
                  <td className="p-2">{t.name}</td>
                  <td className="p-2">{t.count ? t.avg.toFixed(2) : "—"}</td>
                  <td className="p-2">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {!ranked.length && (
          <Link href="/admin/teams" className="underline">
            Add teams
          </Link>
        )}
      </section>
    </fieldset>
  );
}
