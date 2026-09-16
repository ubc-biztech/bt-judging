import type { JudgingAdminSetInput, JudgingSettings } from "@ubc-biztech/sdk";

export const PHASE_LABELS: Record<JudgingSettings["phase"], string> = {
  submission: "Submissions open",
  prelim: "Preliminary judging",
  finals: "Finals",
  closed: "Judging closed",
};
export const PHASE_HELP: Record<JudgingSettings["phase"], string> = {
  submission: "Teams can edit submissions. Judges cannot score yet.",
  prelim: "Submissions are closed. Judges can score their assigned teams.",
  finals: "Finals judges can score the selected finalists.",
  closed: "Scoring and submissions are closed. Saved results remain available.",
};
export const PHASE_ACTIONS: Record<JudgingSettings["phase"], string> = {
  submission: "Reopen submissions",
  prelim: "Start preliminary judging",
  finals: "Start finals",
  closed: "Close judging",
};
export function setupSteps(doc: JudgingAdminSetInput) {
  const assigned = new Set(doc.judges.flatMap((j) => j.assignedTeamIds ?? []));
  const scheduled = new Set(
    doc.settings.schedule?.slots.map((s) => s.teamId) ?? [],
  );
  return [
    {
      label: "Save a rubric",
      href: "/admin/rubric",
      done: !!doc.rubric?.criteria.length,
    },
    { label: "Add judges", href: "/admin/judges", done: doc.judges.length > 0 },
    { label: "Add teams", href: "/admin/teams", done: doc.teams.length > 0 },
    {
      label: "Schedule teams",
      href: "/admin/schedule",
      done:
        doc.teams.length > 0 &&
        doc.teams.every(
          (t) => !!t.id && scheduled.has(t.id) && assigned.has(t.id),
        ),
    },
  ];
}
export function phaseBlocker(
  doc: JudgingAdminSetInput,
  phase: JudgingSettings["phase"],
) {
  if (phase !== "prelim" && phase !== "finals") return "";
  if (!doc.rubric?.criteria.length)
    return "Save a rubric before starting judging.";
  if (!doc.teams.length || !doc.judges.length)
    return "Add teams and judges before starting judging.";
  if (
    phase === "prelim" &&
    !doc.judges.some((j) =>
      j.assignedTeamIds?.some((id) => doc.teams.some((t) => t.id === id)),
    )
  )
    return "Publish a schedule with judge assignments before starting judging.";
  if (phase === "finals") {
    if (
      !doc.settings.finalsTeamIds.some((id) =>
        doc.teams.some((t) => t.id === id),
      )
    )
      return "Select finalists in Finals setup first.";
    if (
      !doc.settings.finalsJudgeIds.some((id) =>
        doc.judges.some((j) => j.id === id),
      )
    )
      return "Select finals judges in Finals setup first.";
  }
  return "";
}
export function validUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}
export function submissionError(
  github: string,
  devpost: string,
  images: string[],
  max: number,
) {
  if (github.trim() && !validUrl(github))
    return "Enter a full GitHub URL starting with https://.";
  if (devpost.trim() && !validUrl(devpost))
    return "Enter a full Devpost URL starting with https://.";
  if (images.length > max)
    return `Keep at most ${max} image links. Remove ${images.length - max} before saving.`;
  if (images.some((url) => !validUrl(url)))
    return "Each image needs a full URL starting with https://.";
  return "";
}

export function withoutTeam(
  d: JudgingAdminSetInput,
  id: string,
): JudgingAdminSetInput {
  const s = d.settings.schedule;
  return {
    ...d,
    teams: d.teams.filter((t) => t.id !== id),
    judges: d.judges.map((j) => ({
      ...j,
      assignedTeamIds: (j.assignedTeamIds ?? []).filter((t) => t !== id),
    })),
    settings: {
      ...d.settings,
      finalsTeamIds: d.settings.finalsTeamIds.filter((t) => t !== id),
      ...(s
        ? {
            schedule: {
              ...s,
              slots: s.slots.filter((x) => x.teamId !== id),
              exclusions: s.exclusions?.filter((x) => x.teamId !== id),
            },
          }
        : {}),
    },
  };
}
export function withoutJudge(
  d: JudgingAdminSetInput,
  id: string,
): JudgingAdminSetInput {
  const s = d.settings.schedule;
  return {
    ...d,
    judges: d.judges.filter((j) => j.id !== id),
    settings: {
      ...d.settings,
      finalsJudgeIds: d.settings.finalsJudgeIds.filter((j) => j !== id),
      ...(s
        ? {
            schedule: {
              ...s,
              rooms: s.rooms.map((r) => ({
                ...r,
                judgeIds: r.judgeIds.filter((j) => j !== id),
              })),
              exclusions: s.exclusions?.filter((x) => x.judgeId !== id),
            },
          }
        : {}),
    },
  };
}
