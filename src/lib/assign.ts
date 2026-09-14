/**
 * Prelim judge assignment, done in the browser and saved with `saveEvent`. The API stores
 * `assignedTeamIds` per judge and enforces nothing about them.
 */
import type { Judge, JudgingTeam } from "@ubc-biztech/sdk";

type Assignable = Pick<Judge, "id" | "assignedTeamIds"> & Partial<Judge>;

/**
 * Give every team `perTeamJudges` distinct judges (or every judge, if there are fewer), spreading
 * load evenly: each pick goes to the judge with the fewest teams so far, ties broken by list order.
 * Existing assignments are replaced. Returns new judge objects; the input is untouched.
 */
export function autoAssign<J extends Assignable>(judges: J[], teams: Pick<JudgingTeam, "id">[], perTeamJudges: number): J[] {
  const per = Math.max(0, Math.min(Math.floor(perTeamJudges), judges.length));
  const load = new Map<string, string[]>(judges.map((j) => [j.id, []]));
  for (const team of teams) {
    const order = [...judges].sort((a, b) => load.get(a.id)!.length - load.get(b.id)!.length);
    for (const judge of order.slice(0, per)) load.get(judge.id)!.push(team.id);
  }
  return judges.map((j) => ({ ...j, assignedTeamIds: load.get(j.id) ?? [] }));
}

/** How many judges cover each team, from the judges' lists. */
export function coverage(judges: Pick<Judge, "assignedTeamIds">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const j of judges) for (const t of j.assignedTeamIds ?? []) out[t] = (out[t] ?? 0) + 1;
  return out;
}
