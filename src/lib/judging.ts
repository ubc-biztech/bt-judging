import type { Rubric } from "@ubc-biztech/sdk";
import type { Criterion } from "@/lib/types";

export const OFFICIAL_JUDGING_RUBRIC: Rubric = {
  name: "HelloHacks 2026 Judging Rubric",
  scaleMax: 30,
  scoreMode: "points",
  criteria: [
    {
      id: "product-thinking-documentation",
      label: "Product Thinking & Documentation",
      description:
        "Problem Definition: Identifies a specific, high-impact challenge and supports the proposed solution with structured user and pain-point research. Documentation: The PRD shows a clear path from prototype to scalable product with an understanding of market needs.",
      weight: 1,
      maxScore: 30
    },
    {
      id: "technical-execution",
      label: "Technical Execution",
      description:
        "Functionality: Operates consistently according to its intended purpose and reflects the product documentation. Integrity: Shows a systematic development process. Implementation Depth: Demonstrates meaningful engineering effort.",
      weight: 1,
      maxScore: 30
    },
    {
      id: "user-experience",
      label: "User Experience",
      description:
        "Interface: Uses professional hierarchy, spacing, and typography. User Journey: Makes intended tasks intuitive and efficient. Inclusivity: Considers a diverse range of user needs across different contexts.",
      weight: 1,
      maxScore: 30
    },
    {
      id: "presentation-pitch",
      label: "Presentation & Pitch",
      description:
        "Storytelling: Clearly connects the problem to the solution. Communication: Explains complex concepts simply and convincingly.",
      weight: 1,
      maxScore: 10
    }
  ]
};

export function criterionMax(
  criterion: Pick<Criterion, "maxScore">,
  fallback: number
) {
  return Math.max(1, Math.round(Number(criterion.maxScore ?? fallback ?? 5) || 5));
}

export function normalizeRubric(input?: Partial<Rubric> | null): Rubric {
  const legacyTemplateIds = new Set([
    "innovation",
    "technical",
    "usability",
    "impact"
  ]);
  const legacyTemplateLabels = new Set([
    "innovation",
    "technical complexity",
    "usability / ux",
    "impact / value"
  ]);
  const looksLikeLegacyTemplate =
    input?.criteria?.length === 4 &&
    input.criteria.every((criterion) => {
      const id = (criterion.id || "").trim().toLowerCase();
      const label = (criterion.label || "").trim().toLowerCase();
      return (
        legacyTemplateIds.has(id) ||
        legacyTemplateLabels.has(label)
      );
    });

  if (looksLikeLegacyTemplate) {
    return OFFICIAL_JUDGING_RUBRIC;
  }

  const scaleMax = Math.max(
    1,
    Math.round(Number(input?.scaleMax ?? OFFICIAL_JUDGING_RUBRIC.scaleMax) || 1)
  );
  const criteriaSource =
    input?.criteria && input.criteria.length
      ? input.criteria
      : OFFICIAL_JUDGING_RUBRIC.criteria;

  return {
    name: input?.name?.trim() || OFFICIAL_JUDGING_RUBRIC.name,
    scaleMax,
    scoreMode: input?.scoreMode || OFFICIAL_JUDGING_RUBRIC.scoreMode,
    criteria: criteriaSource.map((criterion, index) => {
      const fallback =
        OFFICIAL_JUDGING_RUBRIC.criteria.find((item) => item.id === criterion.id) ||
        OFFICIAL_JUDGING_RUBRIC.criteria[index];

      return {
        ...fallback,
        ...criterion,
        weight: Number(criterion.weight ?? fallback?.weight ?? 1) || 1,
        maxScore: criterionMax(criterion, fallback?.maxScore ?? scaleMax)
      };
    })
  };
}

export function rubricTotalMax(rubric: Pick<Rubric, "criteria" | "scaleMax">) {
  return (rubric.criteria || []).reduce(
    (sum, criterion) => sum + criterionMax(criterion, rubric.scaleMax),
    0
  );
}

export function rubricUsesPointTotals(
  rubric: Pick<Rubric, "criteria" | "scaleMax" | "scoreMode"> | null | undefined
) {
  if (!rubric) return false;
  if (rubric.scoreMode === "points") return true;
  return (rubric.criteria || []).some(
    (criterion) => criterionMax(criterion, rubric.scaleMax) !== rubric.scaleMax
  );
}

export function computeReviewTotals(
  rubric: Pick<Rubric, "criteria" | "scaleMax" | "scoreMode">,
  scores: Record<string, number>
) {
  const total = (rubric.criteria || []).reduce((sum, criterion) => {
    const max = criterionMax(criterion, rubric.scaleMax);
    const next = Number(scores[criterion.id] || 0);
    return sum + Math.max(0, Math.min(max, next));
  }, 0);

  if (rubricUsesPointTotals(rubric)) {
    return { total, weightedTotal: total };
  }

  const weightSum = (rubric.criteria || []).reduce(
    (sum, criterion) => sum + Number(criterion.weight || 1),
    0
  );

  const weightedTotal =
    (rubric.criteria || []).reduce((sum, criterion) => {
      const next = Number(scores[criterion.id] || 0);
      return sum + next * Number(criterion.weight || 1);
    }, 0) / Math.max(1, weightSum);

  return { total, weightedTotal };
}
