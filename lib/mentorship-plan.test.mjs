import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  formatPlanDate,
  formatPlanTimestamp,
  milestoneStatus,
  normalisePlanText,
  normaliseTargetDate,
  progressText,
  STATUS_LABEL,
  summariseObjective,
  summarisePlan,
  todayInPlanZone,
} from "./mentorship-plan.ts";

const TODAY = "2026-11-26";
const milestone = (overrides = {}) => ({
  id: "m",
  title: "Finish a SQL course",
  target_date: null,
  completed_at: null,
  completed_by: null,
  ...overrides,
});

test("milestones past their target date and not done are overdue", () => {
  assert.equal(milestoneStatus(milestone({ target_date: "2026-11-25" }), TODAY), "overdue");
  assert.equal(milestoneStatus(milestone({ target_date: "2025-01-01" }), TODAY), "overdue");
});

test("milestones due today or within 7 days are due soon", () => {
  assert.equal(milestoneStatus(milestone({ target_date: TODAY }), TODAY), "due_soon");
  assert.equal(milestoneStatus(milestone({ target_date: "2026-12-03" }), TODAY), "due_soon");
});

test("later or undated milestones are on track", () => {
  assert.equal(milestoneStatus(milestone({ target_date: "2026-12-04" }), TODAY), "on_track");
  assert.equal(milestoneStatus(milestone(), TODAY), "on_track");
});

test("done milestones are done whatever their target date", () => {
  assert.equal(milestoneStatus(milestone({ target_date: "2026-01-01", completed_at: "2026-11-20T08:00:00Z" }), TODAY), "done");
});

test("an objective with every milestone done is met", () => {
  const summary = summariseObjective({
    id: "o", title: "Move into a data engineering role",
    milestones: [
      milestone({ completed_at: "2026-11-01T08:00:00Z" }),
      milestone({ completed_at: "2026-11-02T08:00:00Z", target_date: "2026-10-01" }),
    ],
  }, TODAY);
  assert.equal(summary.status, "met");
  assert.equal(STATUS_LABEL[summary.status], "Objective met");
  assert.deepEqual([summary.done, summary.total, summary.percent], [2, 2, 100]);
});

test("an objective takes the most urgent status of its open milestones", () => {
  const objective = (milestones) => summariseObjective({ id: "o", title: "Goal", milestones }, TODAY).status;
  assert.equal(objective([milestone({ target_date: "2026-11-01" }), milestone({ target_date: TODAY })]), "overdue");
  assert.equal(objective([milestone({ target_date: "2026-11-30" }), milestone()]), "due_soon");
  assert.equal(objective([milestone(), milestone({ completed_at: "2026-11-01T08:00:00Z" })]), "on_track");
});

test("an objective with no milestones says so and shows no progress", () => {
  const summary = summariseObjective({ id: "o", title: "Goal", milestones: [] }, TODAY);
  assert.equal(summary.status, "no_milestones");
  assert.equal(summary.percent, 0);
  assert.equal(progressText(summary.done, summary.total), "No milestones yet");
});

test("the plan totals milestones and met objectives across objectives", () => {
  const plan = summarisePlan([
    { id: "a", title: "A", milestones: [milestone({ completed_at: "2026-11-01T08:00:00Z" })] },
    { id: "b", title: "B", milestones: [milestone({ target_date: "2026-11-01" }), milestone({ completed_at: "2026-11-01T08:00:00Z" }), milestone({ target_date: TODAY })] },
    { id: "c", title: "C", milestones: [] },
  ], TODAY);
  assert.deepEqual(plan, { done: 2, total: 4, percent: 50, overdue: 1, dueSoon: 1, objectives: 3, objectivesMet: 1 });
  assert.equal(progressText(plan.done, plan.total), "2 of 4 milestones done");
  assert.equal(progressText(1, 1), "1 of 1 milestone done");
});

test("an empty plan has no progress", () => {
  assert.deepEqual(summarisePlan([], TODAY), { done: 0, total: 0, percent: 0, overdue: 0, dueSoon: 0, objectives: 0, objectivesMet: 0 });
});

test("today follows the Nairobi calendar at the day boundary", () => {
  // Nairobi is UTC+3 all year: 20:59:59 UTC is 23:59:59 there, 21:00 UTC is midnight.
  assert.equal(todayInPlanZone(new Date("2026-11-26T20:59:59Z")), "2026-11-26");
  assert.equal(todayInPlanZone(new Date("2026-11-26T21:00:00Z")), "2026-11-27");
  assert.equal(todayInPlanZone(new Date("2026-12-31T21:30:00Z")), "2027-01-01");
});

test("a milestone due on a Nairobi day turns overdue at Nairobi midnight", () => {
  const due = milestone({ target_date: "2026-11-26" });
  assert.equal(milestoneStatus(due, todayInPlanZone(new Date("2026-11-26T20:59:59Z"))), "due_soon");
  assert.equal(milestoneStatus(due, todayInPlanZone(new Date("2026-11-26T21:00:00Z"))), "overdue");
  // The seventh day ahead stays due soon until the same boundary.
  const week = milestone({ target_date: "2026-12-03" });
  assert.equal(milestoneStatus(week, todayInPlanZone(new Date("2026-11-25T20:59:59Z"))), "on_track");
  assert.equal(milestoneStatus(week, todayInPlanZone(new Date("2026-11-25T21:00:00Z"))), "due_soon");
});

test("dates add across month and year ends and display without a zone shift", () => {
  assert.equal(addDays("2026-11-28", 7), "2026-12-05");
  assert.equal(addDays("2026-12-29", 7), "2027-01-05");
  assert.equal(formatPlanDate("2026-12-03"), "3 December 2026");
  assert.equal(formatPlanTimestamp("2026-11-26T22:15:00Z"), "27 November 2026");
});

test("titles are trimmed and held to 3 to 120 characters without hidden text", () => {
  assert.deepEqual(normalisePlanText("  Move into a data engineering role  ", "objective"), { ok: true, value: "Move into a data engineering role" });
  assert.equal(normalisePlanText("abc", "milestone").ok, true);
  assert.equal(normalisePlanText("x".repeat(120), "milestone").ok, true);
  // Characters, not UTF-16 units: two emoji are two characters, as in the database.
  assert.equal(normalisePlanText("\u{1F3AF}\u{1F3AF}", "milestone").ok, false);
  assert.equal(normalisePlanText("\u{1F3AF}".repeat(120), "milestone").ok, true);
  for (const bad of ["", "  ab  ", "x".repeat(121), null, 42]) {
    const result = normalisePlanText(bad, "objective");
    assert.equal(result.ok, false);
    assert.match(result.error, /3 to 120 characters/);
  }
  assert.match(normalisePlanText("Two\nlines", "milestone").error, /hidden characters/);
  assert.match(normalisePlanText("Disguised\u202etitle", "milestone").error, /hidden characters/);
});

test("target dates are optional real dates within range", () => {
  assert.deepEqual(normaliseTargetDate(""), { ok: true, value: null });
  assert.deepEqual(normaliseTargetDate(null), { ok: true, value: null });
  assert.deepEqual(normaliseTargetDate("2026-12-03"), { ok: true, value: "2026-12-03" });
  assert.deepEqual(normaliseTargetDate("2028-02-29"), { ok: true, value: "2028-02-29" });
  for (const bad of ["2026-02-30", "2026-13-01", "03/12/2026", "2019-12-31", "2101-01-01", "2026-12-3"]) {
    assert.equal(normaliseTargetDate(bad).ok, false, bad);
  }
});
