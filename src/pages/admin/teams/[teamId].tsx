"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { JudgingEvent, JudgingTeam, Review } from "@ubc-biztech/sdk";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { CopyButton, Status } from "@/components/Feedback";
import SubmissionFields, {
  submissionDraft,
  imageLinks,
  type SubmissionDraft,
} from "@/components/SubmissionFields";
import { eventOrEmpty, listReviews, saveEvent, errorMessage } from "@/lib/bt";
import { submissionError } from "@/lib/ux";
export default function AdminTeamDetail() {
  const router = useRouter();
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page
          key={String(router.query.teamId)}
          teamId={String(router.query.teamId ?? "")}
        />
      </Layout>
    </RoleGate>
  );
}
function Page({ teamId }: { teamId: string }) {
  const [doc, setDoc] = useState<JudgingEvent | null>(null);
  const [team, setTeam] = useState<JudgingTeam | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [draft, setDraft] = useState<SubmissionDraft>(submissionDraft({}));
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function seed(t: JudgingTeam) {
    const d = submissionDraft(t);
    setTeam(t);
    setName(t.name);
    setMembers(t.members.join(", "));
    setDraft(d);
    setSaved(JSON.stringify([t.name, t.members.join(", "), d]));
  }
  async function load() {
    if (!teamId) return;
    setError("");
    try {
      const [d, r] = await Promise.all([
        eventOrEmpty(),
        listReviews({ teamId }),
      ]);
      setDoc(d);
      setReviews(r);
      const t = d.teams.find((x) => x.id === teamId);
      if (t) seed(t);
      else setTeam(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    void load();
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !!team && JSON.stringify([name, members, draft]) !== saved;
  async function save() {
    if (!team || busy || !doc) return;
    setError("");
    setNotice("");
    const urls = imageLinks(draft.images);
    const invalid = submissionError(
      draft.github,
      draft.devpost,
      urls,
      doc.settings.maxImages,
    );
    if (!name.trim() || invalid) {
      setError(invalid || "Enter a team name.");
      return;
    }
    setBusy(true);
    try {
      const d = await saveEvent((d) => {
        if (!d.teams.some((t) => t.id === teamId))
          throw new Error("This team was removed. Return to the teams list.");
        return {
          ...d,
          teams: d.teams.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  name: name.trim(),
                  members: members
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  github: draft.github.trim(),
                  devpost: draft.devpost.trim(),
                  description: draft.description.trim(),
                  imageUrls: urls,
                }
              : t,
          ),
        };
      });
      setDoc(d);
      seed(d.teams.find((t) => t.id === teamId)!);
      setNotice("Team changes saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/teams" className="underline text-sm">
        ← All teams
      </Link>
      <Status
        loading={!doc && !error}
        error={error}
        notice={!dirty ? notice : ""}
        onRetry={!doc ? load : undefined}
      />
      {doc && !team && <p>Team not found.</p>}
      {team && doc && (
        <>
          <h1 className="text-3xl font-semibold">{team.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Team code: <code>{team.code}</code>
            </span>
            <CopyButton value={team.code ?? ""} />
          </div>
          <form
            data-unsaved={dirty}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="ux-primary" disabled={!dirty}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                {dirty && (
                  <>
                    <span className="text-sm text-amber-300">
                      Unsaved changes
                    </span>
                    <button
                      type="button"
                      className="ux-secondary"
                      onClick={() => {
                        if (confirm("Discard unsaved changes?")) seed(team);
                      }}
                    >
                      Discard
                    </button>
                  </>
                )}
              </div>
              <label className="ux-label">
                Team name
                <input
                  className="ux-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="ux-label">
                Members (comma-separated)
                <input
                  className="ux-input"
                  value={members}
                  onChange={(e) => setMembers(e.target.value)}
                />
              </label>
              <SubmissionFields
                value={draft}
                onChange={setDraft}
                maxImages={doc.settings.maxImages}
              />
              <button
                type="button"
                className="text-sm text-rose-300"
                onClick={() => {
                  if (
                    confirm(
                      "Clear project links, description, and images in this draft? Save changes to apply.",
                    )
                  )
                    setDraft(submissionDraft({}));
                }}
              >
                Clear submission draft
              </button>
            </fieldset>
          </form>
          <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4 text-sm">
            <Link href="/admin/schedule" className="underline">
              Schedule & judges
            </Link>
            <Link href="/admin/assign" className="underline">
              Assignment exceptions
            </Link>
            <Link href="/admin/finals" className="underline">
              Finals selection
              {doc.settings.finalsTeamIds.includes(team.id)
                ? " · Selected"
                : ""}
            </Link>
          </div>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Reviews · {reviews.length}
            </h2>
            {reviews.map((r) => (
              <details
                key={r.id}
                className="rounded-xl border border-white/10 p-4"
              >
                <summary>
                  {r.judgeName ||
                    doc.judges.find((j) => j.id === r.judgeId)?.name ||
                    "Judge"}{" "}
                  · {r.round === "finals" ? "Finals" : "Prelim"} ·{" "}
                  {r.weightedTotal.toFixed(2)}
                </summary>
                <dl className="my-3 text-sm">
                  {doc.rubric?.criteria.map((c) => (
                    <div key={c.id} className="flex justify-between gap-3">
                      <dt>{c.label}</dt>
                      <dd>
                        {r.scores[c.id] ?? "—"} /{" "}
                        {c.maxScore ?? doc.rubric?.scaleMax}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="whitespace-pre-line text-sm">
                  {r.feedback || "No written feedback."}
                </p>
              </details>
            ))}
            {!reviews.length && (
              <p className="text-sm text-slate-400">No reviews yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
