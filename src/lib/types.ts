// Names derived from the SDK's types, for pages. Nothing here is a second definition.
import type { JudgingSettings, Review, Rubric } from "@ubc-biztech/sdk";
export type Round = Review["round"];
export type Phase = JudgingSettings["phase"];
export type Criterion = Rubric["criteria"][number];
