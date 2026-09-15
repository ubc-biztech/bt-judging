// The backend compares codes after stripping whitespace and uppercasing; store them that way.
export const normalizeCode = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export type CodePreset = "first" | "first-initial" | "random";
export type TeamCodePreset = "name" | "random";

export const CODE_PRESETS: { id: CodePreset; label: string; hint: string }[] = [
  { id: "first", label: "First name", hint: "JADE; on a clash JADET, then JADETAO" },
  { id: "first-initial", label: "First name + last initial", hint: "JADET; on a clash JADETAO" },
  { id: "random", label: "Random", hint: "Let the backend mint XXXX-XXXX codes" }
];

export const TEAM_CODE_PRESETS: { id: TeamCodePreset; label: string; hint: string }[] = [
  { id: "name", label: "Team name", hint: "PRODUCTX; on a clash PRODUCTX2" },
  { id: "random", label: "Random", hint: "Let the backend mint XXXX-XXXX codes" }
];

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const numbered = (base: string) => [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${base}${n}`);

function judgeCandidates(name: string, preset: Exclude<CodePreset, "random">): string[] {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  const last = rest.join("");
  const f = clean(first) || "JUDGE";
  const l = clean(last);
  const base = preset === "first" ? [f, f + l.slice(0, 1), f + l] : [f + l.slice(0, 1), f + l];
  const uniq = [...new Set(base.filter(Boolean))];
  return [...uniq, ...numbered(uniq[0]!)];
}

function teamCandidates(name: string): string[] {
  const base = clean(name) || "TEAM";
  return [base, ...numbered(base)];
}

/**
 * `taken` is every other code in the event; items earlier in the list claim before later ones,
 * so two "Jade"s get JADE and JADET. Returns copies; the input is untouched.
 */
function assign<T extends { name: string; code?: string }>(items: T[], taken: Iterable<string>, candidates: ((name: string) => string[]) | null): T[] {
  if (!candidates) return items.map((i) => ({ ...i, code: undefined }));
  const used = new Set([...taken].map(normalizeCode));
  return items.map((i) => {
    const code = candidates(i.name).find((c) => !used.has(c)) ?? `${clean(i.name)}${Date.now() % 1000}`;
    used.add(code);
    return { ...i, code };
  });
}

export const presetCodes = <J extends { name: string; code?: string }>(judges: J[], taken: Iterable<string>, preset: CodePreset) =>
  assign(judges, taken, preset === "random" ? null : (n) => judgeCandidates(n, preset));

export const presetTeamCodes = <T extends { name: string; code?: string }>(teams: T[], taken: Iterable<string>, preset: TeamCodePreset) =>
  assign(teams, taken, preset === "random" ? null : teamCandidates);
