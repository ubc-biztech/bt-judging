// The backend compares codes after stripping whitespace and uppercasing; store them that way.
export const normalizeCode = (s: string) => s.replace(/\s+/g, "").toUpperCase();

export type CodePreset = "first" | "first-initial" | "random";

export const CODE_PRESETS: { id: CodePreset; label: string; hint: string }[] = [
  { id: "first", label: "First name", hint: "JADE; on a clash JADET, then JADETAO" },
  { id: "first-initial", label: "First name + last initial", hint: "JADET; on a clash JADETAO" },
  { id: "random", label: "Random", hint: "Let the backend mint XXXX-XXXX codes" }
];

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function candidates(name: string, preset: Exclude<CodePreset, "random">): string[] {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  const last = rest.join("");
  const f = clean(first) || "JUDGE";
  const l = clean(last);
  const base = preset === "first" ? [f, f + l.slice(0, 1), f + l] : [f + l.slice(0, 1), f + l];
  const uniq = [...new Set(base.filter(Boolean))];
  return [...uniq, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${uniq[0]}${n}`)];
}

/**
 * New codes for every judge. `taken` is every other code in the event (teams, for instance);
 * judges earlier in the list claim before later ones, so two "Jade"s get JADE and JADET.
 */
export function presetCodes<J extends { name: string; code?: string }>(judges: J[], taken: Iterable<string>, preset: CodePreset): J[] {
  if (preset === "random") return judges.map((j) => ({ ...j, code: undefined }));
  const used = new Set([...taken].map(normalizeCode));
  return judges.map((j) => {
    const code = candidates(j.name, preset).find((c) => !used.has(c)) ?? `${clean(j.name)}${Date.now() % 1000}`;
    used.add(code);
    return { ...j, code };
  });
}
