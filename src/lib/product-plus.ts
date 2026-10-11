import type { Rubric } from "@ubc-biztech/sdk";

export const PRODUCT_PLUS_ID = "product-plus";
export const PRODUCT_PLUS_NAME = "Product+ 2026";
export const PRODUCT_PLUS_RUBRIC_SOURCE =
  "https://docs.google.com/document/d/1q-HdMmtv2SShtUhxNqdWlkrMFmpDF_kEbnOLPSQ3c4w/edit";

export const PRODUCT_PLUS_PROTOTYPE_GUIDANCE =
  "Any prototype format is acceptable. Technical depth is optional: reward it when it strengthens the core workflow, tests a key assumption, or addresses a relevant constraint—not complexity or effort alone. Teams must identify simulated functionality.";

// Bands expand the source document's “Look For” guidance; organizers can edit them.
// Store them in the existing description field so every API consumer retains the guide.
export const PRODUCT_PLUS_RUBRIC: Rubric = {
  name: "Product+ · Semifinals & Finals",
  scaleMax: 10,
  scoreMode: "weighted",
  criteria: [
    {
      id: "problem-definition",
      label: "Problem Definition",
      description: `How clearly does the team establish a meaningful user problem?
Look for: A specific customer segment and user, credible evidence of pain points, the current workflow, and why the problem deserves priority.

1–3: The target user or problem is unclear. Claims have little supporting evidence.
4–6: A user and pain point are identified, but evidence, workflow context, or prioritization is weak.
7–8: A specific user and workflow are supported by credible evidence, with a clear reason to prioritize the problem.
9–10: Compelling evidence reveals a nuanced unmet need. The team convincingly explains its importance relative to other problems.`,
      weight: 1,
      maxScore: 10,
    },
    {
      id: "product-solution",
      label: "Product Solution",
      description: `How well does the solution address the problem and justify investment?
Look for: Research-backed feature priorities, improvement over current alternatives, reasons retailers would adopt it, and business value to SAP relative to expected costs.

1–3: Features have little connection to the problem. User or business value is largely unexplained.
4–6: The idea addresses part of the problem, but feature priorities, differentiation, or adoption assumptions are weak.
7–8: Research supports the core features, improvement over alternatives, and a plausible retailer and SAP business case.
9–10: A focused solution makes a compelling investment case, with well-evidenced priorities and explicit value, cost, and adoption trade-offs.`,
      weight: 1,
      maxScore: 10,
    },
    {
      id: "prototype",
      label: "Prototype",
      description: `How convincingly does the prototype demonstrate the solution?
Look for: A clear core workflow, intuitive interactions, and purposeful design. Reward technical depth only when it meaningfully strengthens the product vision. Simulated functionality must be identified.

1–3: The core workflow is missing or difficult to follow; the prototype does not demonstrate the proposed value.
4–6: Parts of the workflow are visible, but important gaps or confusing interactions limit the demonstration.
7–8: An intuitive core workflow demonstrates the product's value, with clear design choices and transparent simulated functionality.
9–10: A convincing, coherent demonstration validates the core experience and key assumptions. Any technical work meaningfully strengthens the solution.`,
      weight: 1,
      maxScore: 10,
    },
    {
      id: "implementation-plan",
      label: "Implementation Plan",
      description: `How realistically could the product be delivered and adopted?
Look for: Key resources and dependencies, technical feasibility, major risks, realistic milestones, an adoption plan, and measurable success criteria.

1–3: The plan is absent or unrealistic. Critical resources, dependencies, or risks are overlooked.
4–6: Basic steps are outlined, but feasibility, ownership, adoption, or success measures remain vague.
7–8: A credible plan connects resources, dependencies, milestones, risks, adoption, and measurable outcomes.
9–10: A well-prioritized plan anticipates constraints and failure points, with realistic mitigations and clear ways to test progress and adoption.`,
      weight: 1,
      maxScore: 10,
    },
    {
      id: "stakeholder-alignment",
      label: "Stakeholder Alignment",
      description: `How thoughtfully does the team address competing stakeholder needs?
Look for: Relevant strategy, technical, financial, and marketing concerns; evidence-based answers; acknowledged limitations; and justified trade-offs when defending or adapting decisions.

1–3: Important stakeholder concerns are missed. Decisions are unsupported or dismiss conflicting needs.
4–6: Several perspectives are acknowledged, but responses or trade-offs lack evidence and depth.
7–8: The team addresses relevant stakeholder concerns, explains trade-offs with evidence, and acknowledges limitations.
9–10: The team reconciles competing priorities convincingly, defends or adapts decisions thoughtfully, and explains the consequences of its trade-offs.`,
      weight: 1,
      maxScore: 10,
    },
    {
      id: "presentation-communication",
      label: "Presentation & Q&A Communication",
      description: `How clearly does the team present its case and respond to questions?
Look for: A persuasive narrative, readable visuals, clear explanations, and direct, concise Q&A responses.

1–3: The story is difficult to follow. Unclear visuals or responses obscure the proposal.
4–6: The main idea is understandable, but structure, pacing, visuals, or answers are inconsistent.
7–8: A clear, persuasive presentation uses readable visuals and explains decisions well, with direct Q&A responses.
9–10: A focused narrative makes complex ideas easy to understand. Answers are precise, responsive, and candid about uncertainty.`,
      weight: 1,
      maxScore: 10,
    },
  ],
};

/** The backend sums score × weight. Normalize multipliers so ten on every item = 100. */
export function scaleProductRubric(rubric: Rubric): Rubric {
  const sum = rubric.criteria.reduce((n, c) => n + c.weight, 0);
  if (
    !rubric.criteria.length ||
    !Number.isFinite(sum) ||
    rubric.criteria.some((c) => !Number.isFinite(c.weight) || c.weight <= 0)
  )
    throw new Error("Each criterion needs a positive weight.");
  return {
    ...rubric,
    scaleMax: 10,
    scoreMode: "weighted",
    criteria: rubric.criteria.map((c) => ({
      ...c,
      maxScore: 10,
      weight: (c.weight / sum) * 10,
    })),
  };
}
