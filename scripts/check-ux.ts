import assert from "node:assert/strict";
import {
  phaseBlocker,
  setupSteps,
  submissionError,
  withoutJudge,
  withoutTeam,
} from "../src/lib/ux";
import {
  assignmentsFrom,
  excludeFromBlock,
  place,
  unplace,
  autoFill,
  scheduleErrors,
} from "../src/lib/schedule";
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

// Scheduling must never overwrite a team or double-book a room.
const scheduled = event.settings.schedule!;
const twoTeams = [
  ...event.teams.map((t) => ({ ...t, id: t.id! })),
  { id: "t2", name: "Team Two", members: [] },
];
assert.throws(() => place(scheduled, "t2", "b1", "r1"), /occupied/);
assert.throws(() => place(scheduled, "t2", "missing", "r1"), /existing/);
assert.equal(scheduled.slots[0].teamId, "t1");
const filled = autoFill(scheduled, twoTeams, 20);
assert.equal(filled.blocks.length, 2);
assert.equal(filled.blocks[1].startsAt, "10:20");
assert.deepEqual(filled.slots[0], scheduled.slots[0]);
assert.deepEqual(scheduleErrors(filled, twoTeams, event.judges), []);
assert.deepEqual(
  assignmentsFrom(unplace(filled, "t1"), event.judges)[0].assignedTeamIds,
  ["t2"],
);
assert.match(
  scheduleErrors(filled, event.teams, event.judges).join(" "),
  /removed/,
);
const doubleBooked = {
  ...filled,
  rooms: [...filled.rooms, { id: "r2", name: "Second room", judgeIds: ["j1"] }],
  slots: [scheduled.slots[0], { teamId: "t2", blockId: "b1", roomId: "r2" }],
};
assert.match(
  scheduleErrors(doubleBooked, twoTeams, event.judges).join(" "),
  /two rooms/,
);
assert.deepEqual(
  scheduleErrors(
    {
      ...doubleBooked,
      rooms: doubleBooked.rooms.map((r) =>
        r.id === "r2" ? { ...r, judgeIds: ["j1", "j2"] } : r,
      ),
      exclusions: [{ judgeId: "j1", teamId: "t2" }],
    },
    twoTeams,
    [...event.judges, { id: "j2", name: "Second judge" }],
  ),
  [],
);
assert.match(
  scheduleErrors(
    { ...filled, slots: [...filled.slots, filled.slots[0]] },
    twoTeams,
    event.judges,
  ).join(" "),
  /more than once/,
);
assert.match(
  scheduleErrors(
    {
      ...filled,
      blocks: filled.blocks.map((b) => ({ ...b, startsAt: "10:00" })),
    },
    twoTeams,
    event.judges,
  ).join(" "),
  /different start times/,
);
assert.match(
  scheduleErrors(
    { ...filled, rooms: filled.rooms.map((r) => ({ ...r, judgeIds: [] })) },
    twoTeams,
    event.judges,
  ).join(" "),
  /no judges/,
);
console.log(
  "PASS occupied-slot guard, auto-fill preservation, unscheduling assignments, stale data, duplicate teams/times, and judge conflicts including exclusions",
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
