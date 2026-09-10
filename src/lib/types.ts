// Portal types are the SDK's types. Kept as a module so pages keep their existing imports.
import type { JudgingRubricSetInput } from "@ubc-biztech/sdk";
export type { Judge, Link, Review, Settings, Team, Round, Phase } from "./data";
/** A rubric as edited client-side: what `setRubric` takes (no server timestamp). */
export type Rubric = JudgingRubricSetInput;
export type Criterion = Rubric["criteria"][number];
