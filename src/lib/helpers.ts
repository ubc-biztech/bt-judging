export function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function calcTotals(
  scores: Record<string, number>,
  weights: Record<string, number>
) {
  let total = 0,
    weighted = 0;
  for (const k of Object.keys(scores)) {
    total += scores[k];
    weighted += scores[k] * (weights[k] ?? 1);
  }
  return { total, weightedTotal: weighted };
}
