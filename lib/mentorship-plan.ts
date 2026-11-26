// The mentorship plan both people see on a connection (#187): objectives,
// milestones and how progress compares with the plan. Pure functions so the
// status rules, date handling and validation are unit tested.

export const PLAN_TEXT_MIN = 3;
export const PLAN_TEXT_MAX = 120;
export const MAX_OBJECTIVES = 5;
export const MAX_MILESTONES = 8;
/** A milestone due within this many days (today included) is "Due soon". */
export const DUE_SOON_DAYS = 7;
/** Target dates are calendar days for members in Kenya. */
export const PLAN_TIME_ZONE = "Africa/Nairobi";

export const EXAMPLE_OBJECTIVES = [
  "Move into a data engineering role",
  "Build confidence presenting to senior leaders",
] as const;

export interface PlanMilestone {
  id: string;
  title: string;
  /** Calendar date as YYYY-MM-DD, or null when no target is set. */
  target_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

export interface PlanObjective {
  id: string;
  title: string;
  milestones: PlanMilestone[];
}

export type MilestoneStatus = "done" | "overdue" | "due_soon" | "on_track";
export type ObjectiveStatus = "met" | "overdue" | "due_soon" | "on_track" | "no_milestones";

export const STATUS_LABEL: Record<MilestoneStatus | ObjectiveStatus, string> = {
  done: "Done",
  met: "Objective met",
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
  no_milestones: "No milestones yet",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in Nairobi as YYYY-MM-DD. */
export function todayInPlanZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PLAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Compares a milestone with the plan on the given Nairobi date. */
export function milestoneStatus(milestone: PlanMilestone, today: string): MilestoneStatus {
  if (milestone.completed_at) return "done";
  if (!milestone.target_date) return "on_track";
  // YYYY-MM-DD strings sort in date order.
  if (milestone.target_date < today) return "overdue";
  if (milestone.target_date <= addDays(today, DUE_SOON_DAYS)) return "due_soon";
  return "on_track";
}

export interface ProgressSummary {
  done: number;
  total: number;
  /** Whole percentage of milestones done, 0 when there are none. */
  percent: number;
  overdue: number;
  dueSoon: number;
}

function summariseMilestones(milestones: PlanMilestone[], today: string): ProgressSummary {
  let done = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const milestone of milestones) {
    const status = milestoneStatus(milestone, today);
    if (status === "done") done += 1;
    else if (status === "overdue") overdue += 1;
    else if (status === "due_soon") dueSoon += 1;
  }
  const total = milestones.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, overdue, dueSoon };
}

export interface ObjectiveSummary extends ProgressSummary {
  status: ObjectiveStatus;
}

export function summariseObjective(objective: PlanObjective, today: string): ObjectiveSummary {
  const progress = summariseMilestones(objective.milestones, today);
  let status: ObjectiveStatus;
  if (progress.total === 0) status = "no_milestones";
  else if (progress.done === progress.total) status = "met";
  else if (progress.overdue > 0) status = "overdue";
  else if (progress.dueSoon > 0) status = "due_soon";
  else status = "on_track";
  return { ...progress, status };
}

export interface PlanSummary extends ProgressSummary {
  objectives: number;
  objectivesMet: number;
}

export function summarisePlan(objectives: PlanObjective[], today: string): PlanSummary {
  const progress = summariseMilestones(objectives.flatMap((objective) => objective.milestones), today);
  const objectivesMet = objectives.filter((objective) => summariseObjective(objective, today).status === "met").length;
  return { ...progress, objectives: objectives.length, objectivesMet };
}

/** "2 of 4 milestones done", with the singular for a single milestone. */
export function progressText(done: number, total: number): string {
  if (total === 0) return "No milestones yet";
  return `${done} of ${total} ${total === 1 ? "milestone" : "milestones"} done`;
}

/** A plan date such as "3 December 2026"; dates carry no time, so no zone shift. */
export function formatPlanDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The Nairobi calendar date of a stored timestamp, formatted for display. */
export function formatPlanTimestamp(timestamp: string): string {
  return formatPlanDate(todayInPlanZone(new Date(timestamp)));
}

/** Control characters and text-direction overrides, which can disguise text. */
const HIDDEN_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Trims an objective or milestone title and checks it matches the database rules. */
export function normalisePlanText(value: unknown, kind: "objective" | "milestone"): Result<string> {
  const text = typeof value === "string" ? value.trim() : "";
  // Count code points, as the database's char_length does, not UTF-16 units.
  const length = [...text].length;
  if (length < PLAN_TEXT_MIN || length > PLAN_TEXT_MAX) {
    return { ok: false, error: `Write the ${kind} in ${PLAN_TEXT_MIN} to ${PLAN_TEXT_MAX} characters.` };
  }
  if (HIDDEN_CHARACTERS.test(text)) {
    return { ok: false, error: `Remove line breaks or hidden characters from the ${kind}.` };
  }
  return { ok: true, value: text };
}

/** Accepts an empty target date (none) or a real calendar date from 2020 to 2100. */
export function normaliseTargetDate(value: unknown): Result<string | null> {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: true, value: null };
  const match = ISO_DATE.exec(text);
  // Date.UTC rolls 30 February over to March, so a real date round-trips unchanged.
  const valid = match !== null && (() => {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  })();
  if (!valid || text < "2020-01-01" || text > "2100-12-31") {
    return { ok: false, error: "Choose a target date between 2020 and 2100, or leave it empty." };
  }
  return { ok: true, value: text };
}
