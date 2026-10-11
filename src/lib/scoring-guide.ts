export const SCORE_BANDS = [
  { min: 1, max: 3, label: "Limited" },
  { min: 4, max: 6, label: "Developing" },
  { min: 7, max: 8, label: "Strong" },
  { min: 9, max: 10, label: "Exceptional" },
] as const;

export function scoringGuide(description = "") {
  const summary: string[] = [];
  const bands: {
    min: number;
    max: number;
    label: string;
    description: string;
  }[] = [];
  for (const line of description.split("\n")) {
    const match = /^(\d+)[–-](\d+):\s*(.+)$/.exec(line.trim());
    const band =
      match &&
      SCORE_BANDS.find(
        (b) => b.min === Number(match[1]) && b.max === Number(match[2]),
      );
    if (match && band && !bands.some((b) => b.min === band.min)) {
      bands.push({ ...band, description: match[3] });
    } else {
      summary.push(line);
    }
  }
  return {
    summary: summary.join("\n").trim(),
    bands: bands.sort((a, b) => a.min - b.min),
  };
}
