import assert from "node:assert/strict";
import {
  phaseBlocker,
  setupSteps,
  submissionError,
  withoutJudge,
  withoutTeam,
} from "../src/lib/ux";
import { assignmentsFrom, excludeFromBlock } from "../src/lib/schedule";
import { presetCodes, presetTeamCodes } from "../src/lib/codes";
import type { JudgingAdminSetInput } from "@ubc-biztech/sdk";

const event: JudgingAdminSetInput = {
  settings: {
    eventName: "Test event",
    phase: "submission",
    perTeamJudges: 1,
    finalsTopN: 1,
    finalsJudgeIds: ["j1"],
    finalsTeamIds: ["t1"],
    showTeamFeedback: false,
    allowJudgeSeeOthers: false,
    anonymizeTeams: false,
    lockSubmissions: false,
    maxImages: 2,
    schedule: {
      rooms: [{ id: "r1", name: "Room", judgeIds: ["j1"] }],
      blocks: [{ id: "b1", label: "Block", startsAt: "10:00" }],
      slots: [{ teamId: "t1", roomId: "r1", blockId: "b1" }],
      exclusions: [],
      changes: [],
    },
  },
  rubric: {
    name: "Rubric",
    scaleMax: 5,
    scoreMode: "points",
    criteria: [{ id: "c1", label: "Criterion", maxScore: 5, weight: 1 }],
  },
  links: [],
  judges: [
    { id: "j1", name: "Jade Tran", code: "JADE", assignedTeamIds: ["t1"] },
  ],
  teams: [{ id: "t1", name: "Team One", members: [], code: "TEAMONE" }],
};
assert.equal(phaseBlocker(event, "prelim"), "");
assert.equal(phaseBlocker(event, "finals"), "");
assert.match(phaseBlocker({ ...event, rubric: null }, "prelim"), /rubric/);
assert.match(
  phaseBlocker(
    { ...event, judges: [{ ...event.judges[0], assignedTeamIds: [] }] },
    "prelim",
  ),
  /schedule/,
);
assert.match(
  phaseBlocker(
    { ...event, settings: { ...event.settings, finalsJudgeIds: [] } },
    "finals",
  ),
  /judges/,
);
assert.ok(setupSteps(event).every((s) => s.done));
assert.equal(setupSteps({ ...event, rubric: null })[0].done, false);
const noTeam = withoutTeam(event, "t1");
assert.equal(noTeam.teams.length, 0);
assert.deepEqual(noTeam.judges[0].assignedTeamIds, []);
assert.deepEqual(noTeam.settings.finalsTeamIds, []);
assert.deepEqual(noTeam.settings.schedule?.slots, []);
const noJudge = withoutJudge(event, "j1");
assert.deepEqual(noJudge.settings.finalsJudgeIds, []);
assert.deepEqual(noJudge.settings.schedule?.rooms[0].judgeIds, []);
const reset = excludeFromBlock(event.settings.schedule!, "j1", "b1");
assert.deepEqual(assignmentsFrom(reset, event.judges)[0].assignedTeamIds, []);
assert.deepEqual(
  assignmentsFrom(reset, event.judges)[0].assignedTeamIds,
  [],
  "Publishing again must not undo a reset",
);
assert.equal(
  event.judges[0].assignedTeamIds?.length,
  1,
  "Helpers must preserve original data",
);
assert.equal(
  presetCodes(
    [{ name: "Jade Tao", code: undefined as string | undefined }],
    ["JADE", "JADET"],
    "first",
  )[0].code,
  "JADETAO",
);
assert.notEqual(
  presetTeamCodes(
    [{ name: "Team One", code: undefined as string | undefined }],
    ["TEAMONE"],
    "name",
  )[0].code,
  "TEAMONE",
);
assert.equal(
  submissionError(
    "https://github.com/example/project",
    "",
    ["https://example.test/image.png"],
    2,
  ),
  "",
);
assert.match(submissionError("github.com/project", "", [], 2), /full GitHub/);
assert.match(
  submissionError(
    "",
    "",
    ["https://example.test/a", "https://example.test/b"],
    1,
  ),
  /Remove 1/,
);
assert.match(submissionError("", "", ["javascript:alert(1)"], 2), /full URL/);
console.log(
  "PASS phase prerequisites, setup readiness, removal cleanup, persistent assignment resets, code collisions, and submission validation",
);

const many = presetCodes(
  Array.from({ length: 25 }, () => ({
    name: "Jay Park",
    code: undefined as string | undefined,
  })),
  [],
  "first",
);
assert.equal(new Set(many.map((j) => j.code)).size, 25);

// Event links parse a complete scope; changing scope must never reuse another event's code.
import { parseEventKey, initializeEvent } from "../src/lib/event";
assert.deepEqual(parseEventKey("hello-hacks-2026"), {
  id: "hello-hacks",
  year: 2026,
});
for (const bad of [
  "../event-2026",
  "HELLO-2026",
  "event",
  "event-1999",
  "event-2101",
  "event--2026",
])
  assert.equal(parseEventKey(bad), null);
const store = new Map<string, string>();
const storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
};
Object.assign(globalThis, {
  localStorage: storage,
  window: { dispatchEvent: () => {} },
  StorageEvent: class {},
});
import { getSession, setSession } from "../src/lib/session";
initializeEvent("hellohacks-2026");
setSession({ role: "team", id: "current-team", code: "CURRENT" });
initializeEvent("product-2025");
assert.equal(getSession(), null);
setSession({ role: "team", id: "past-team", code: "PAST" });
initializeEvent("hellohacks-2026");
assert.equal(getSession()?.id, "current-team");
initializeEvent("product-2025");
assert.equal(getSession()?.id, "past-team");
console.log("Event scope and session checks passed.");
