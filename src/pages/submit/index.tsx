"use client";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { Status } from "@/components/Feedback";
import SubmissionFields, {
  submissionDraft,
  submissionKey,
  imageLinks,
  type SubmissionDraft,
} from "@/components/SubmissionFields";
import { useClientSession } from "@/lib/session";
import { usePoll } from "@/lib/usePoll";
import { judging, errorMessage, eventOrEmpty } from "@/lib/bt";
import { submissionError } from "@/lib/ux";
export default function Submit() {
  return (
    <RoleGate allow={["team"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}
function Page() {
  const { session } = useClientSession();
  const teamId = session?.role === "team" ? session.id : "";
  const poll = usePoll(teamId ? eventOrEmpty : null, [teamId]);
  const team = poll.data?.teams.find((t) => t.id === teamId);
  const settings = poll.data?.settings;
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!team || loadedFor === team.id) return;
    const d = submissionDraft(team);
    setDraft(d);
    setSaved(submissionKey(d));
    setLoadedFor(team.id);
  }, [team, loadedFor]);
  const dirty = !!draft && submissionKey(draft) !== saved;
  const closed = settings?.phase !== "submission" || settings?.lockSubmissions;
  async function save() {
    if (!team || !draft || busy || closed) return;
    setError("");
    setNotice("");
    const urls = imageLinks(draft.images);
    const invalid = submissionError(
      draft.github,
      draft.devpost,
      urls,
      settings?.maxImages ?? 10,
    );
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const fresh = await eventOrEmpty();
      if (
        fresh.settings.phase !== "submission" ||
        fresh.settings.lockSubmissions
      )
        throw new Error(
          "Submissions have closed. Your draft is preserved; contact an organizer.",
        );
      const current = fresh.teams.find((t) => t.id === team.id);
      if (!current)
        throw new Error(
          "Your team is no longer available. Contact an organizer.",
        );
      const limitError = submissionError(
        draft.github,
        draft.devpost,
        urls,
        fresh.settings.maxImages,
      );
      if (limitError) throw new Error(limitError);
      await judging().team(team.id).update({
        name: current.name,
        members: current.members,
        github: draft.github.trim(),
        devpost: draft.devpost.trim(),
        description: draft.description.trim(),
        imageUrls: urls,
      });
      setSaved(submissionKey(draft));
      setNotice("Submission saved.");
      void poll.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-3xl font-semibold">Team submission</h1>
      <Status
        loading={!poll.data && !poll.error}
        error={poll.error ? errorMessage(poll.error) : ""}
        onRetry={poll.refresh}
      />
      {poll.data && !team && (
        <p>Your team is no longer available. Contact an organizer.</p>
      )}
      {team && draft && (
        <>
          <p className="font-medium">{team.name}</p>
          {closed && (
            <p
              role="status"
              className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm"
            >
              Submissions are closed. Contact an organizer if a correction is
              needed.{dirty && " Your unsaved draft is preserved."}
            </p>
          )}
          <form
            data-unsaved={dirty}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <fieldset disabled={busy || closed || !!poll.error}>
              <SubmissionFields
                value={draft}
                onChange={setDraft}
                maxImages={settings?.maxImages ?? 10}
              />
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="ux-primary"
                disabled={busy || closed || !!poll.error}
              >
                {busy ? "Saving…" : "Save submission"}
              </button>
              {dirty && (
                <span className="text-sm text-amber-300">Unsaved changes</span>
              )}
            </div>
            <Status error={error} notice={!dirty ? notice : ""} />
          </form>
        </>
      )}
    </div>
  );
}
