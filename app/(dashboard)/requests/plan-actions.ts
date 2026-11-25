"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/profile-privacy";
import {
  MAX_MILESTONES,
  MAX_OBJECTIVES,
  normalisePlanText,
  normaliseTargetDate,
} from "@/lib/mentorship-plan";

export type PlanIntent =
  | "add_objective"
  | "rename_objective"
  | "delete_objective"
  | "add_milestone"
  | "edit_milestone"
  | "set_milestone_done"
  | "delete_milestone";

export interface PlanActionState {
  ok: boolean;
  error: string | null;
  /** Announced in the plan's live region after a successful save. */
  message: string | null;
  intent: PlanIntent | null;
  /** The connection, objective or milestone the form acted on. */
  targetId: string | null;
  /** What the member typed, so a failed form keeps it. */
  title: string;
  targetDate: string;
  /** Changes on every response so the form can react to repeated results. */
  nonce: number;
}

const INTENTS: PlanIntent[] = [
  "add_objective", "rename_objective", "delete_objective",
  "add_milestone", "edit_milestone", "set_milestone_done", "delete_milestone",
];

const UNAVAILABLE = "This item is no longer available. Refresh the page and try again.";

interface DatabaseError {
  code?: string;
  hint?: string | null;
}

/** Maps database errors to plain messages without exposing internals. */
function planErrorMessage(error: DatabaseError, fallback: string): string {
  if (error.hint === "objective_limit") return `A plan can hold up to ${MAX_OBJECTIVES} objectives. Remove one before adding another.`;
  if (error.hint === "milestone_limit") return `An objective can hold up to ${MAX_MILESTONES} milestones. Remove one before adding another.`;
  if (error.code === "42501") return "This connection is not available for planning right now.";
  if (error.code === "23514") return "Write 3 to 120 characters without line breaks, and choose a target date between 2020 and 2100.";
  if (error.code === "23503") return UNAVAILABLE;
  return fallback;
}

/**
 * Adds, edits, completes or removes objectives and milestones in a
 * connection's mentorship plan (#187). Row-level security limits every change
 * to the two people in the connection; this action validates input first so
 * members get clear messages.
 */
export async function mentorshipPlanAction(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const rawIntent = String(formData.get("intent") ?? "");
  const intent = INTENTS.includes(rawIntent as PlanIntent) ? (rawIntent as PlanIntent) : null;
  const targetId = String(formData.get("target_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").slice(0, 500);
  const targetDate = String(formData.get("target_date") ?? "").slice(0, 20);
  const reply = (fields: Partial<PlanActionState>): PlanActionState => ({
    ok: false, error: null, message: null, intent, targetId: targetId || null, title, targetDate,
    nonce: Date.now() + Math.random(), ...fields,
  });
  const fail = (error: string) => reply({ ok: false, error });

  if (!intent || !isValidUuid(targetId)) return fail("Choose a valid plan action and try again.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Your session has ended. Sign in again to update the plan.");

  const done = (message: string) => {
    revalidatePath("/requests");
    return reply({ ok: true, message, title: "", targetDate: "" });
  };

  switch (intent) {
    case "add_objective": {
      const text = normalisePlanText(title, "objective");
      if (!text.ok) return fail(text.error);
      const { error } = await supabase
        .from("mentorship_objectives")
        .insert({ connection_id: targetId, title: text.value });
      if (error) return fail(planErrorMessage(error, "We couldn't add this objective right now. Please try again."));
      return done("Objective added.");
    }
    case "rename_objective": {
      const text = normalisePlanText(title, "objective");
      if (!text.ok) return fail(text.error);
      const { data, error } = await supabase
        .from("mentorship_objectives")
        .update({ title: text.value })
        .eq("id", targetId)
        .select("id");
      if (error) return fail(planErrorMessage(error, "We couldn't save this objective right now. Please try again."));
      if (!data?.length) return fail(UNAVAILABLE);
      return done("Objective saved.");
    }
    case "delete_objective": {
      const { data, error } = await supabase
        .from("mentorship_objectives")
        .delete()
        .eq("id", targetId)
        .select("id");
      if (error) return fail(planErrorMessage(error, "We couldn't remove this objective right now. Please try again."));
      if (!data?.length) return fail(UNAVAILABLE);
      return done("Objective and its milestones removed.");
    }
    case "add_milestone": {
      const text = normalisePlanText(title, "milestone");
      if (!text.ok) return fail(text.error);
      const date = normaliseTargetDate(targetDate);
      if (!date.ok) return fail(date.error);
      // The objective's connection comes from the database, never the form.
      const { data: objective, error: lookupError } = await supabase
        .from("mentorship_objectives")
        .select("connection_id")
        .eq("id", targetId)
        .maybeSingle<{ connection_id: string }>();
      if (lookupError) return fail("We couldn't add this milestone right now. Please try again.");
      if (!objective) return fail(UNAVAILABLE);
      const { error } = await supabase.from("mentorship_milestones").insert({
        objective_id: targetId,
        connection_id: objective.connection_id,
        title: text.value,
        target_date: date.value,
      });
      if (error) return fail(planErrorMessage(error, "We couldn't add this milestone right now. Please try again."));
      return done("Milestone added.");
    }
    case "edit_milestone": {
      const text = normalisePlanText(title, "milestone");
      if (!text.ok) return fail(text.error);
      const date = normaliseTargetDate(targetDate);
      if (!date.ok) return fail(date.error);
      const { data, error } = await supabase
        .from("mentorship_milestones")
        .update({ title: text.value, target_date: date.value })
        .eq("id", targetId)
        .select("id");
      if (error) return fail(planErrorMessage(error, "We couldn't save this milestone right now. Please try again."));
      if (!data?.length) return fail(UNAVAILABLE);
      return done("Milestone saved.");
    }
    case "set_milestone_done": {
      const markDone = formData.get("done") === "true";
      // The database replaces this time with its own clock and records who did it.
      const { data, error } = await supabase
        .from("mentorship_milestones")
        .update({ completed_at: markDone ? new Date().toISOString() : null })
        .eq("id", targetId)
        .select("id");
      if (error) return fail(planErrorMessage(error, "We couldn't update this milestone right now. Please try again."));
      if (!data?.length) return fail(UNAVAILABLE);
      return done(markDone ? "Milestone marked as done." : "Milestone marked as not done.");
    }
    case "delete_milestone": {
      const { data, error } = await supabase
        .from("mentorship_milestones")
        .delete()
        .eq("id", targetId)
        .select("id");
      if (error) return fail(planErrorMessage(error, "We couldn't remove this milestone right now. Please try again."));
      if (!data?.length) return fail(UNAVAILABLE);
      return done("Milestone removed.");
    }
  }
}
