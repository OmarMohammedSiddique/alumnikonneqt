import type { SupabaseClient } from "@supabase/supabase-js";

export interface RequestState {
  error: string | null;
  ok: boolean;
}

type Decision = "cancel" | "accept" | "decline";

// Raised by the enforce_same_account_kind trigger (#109) when a request or a
// connection would pair a fictional demo account with a real member.
const ACCOUNT_KIND_REFUSAL = "demo accounts and members cannot be paired";

export const ACCOUNT_KIND_REQUEST_MESSAGE =
  "This request could not be sent. Demo accounts and members cannot send requests to each other.";
export const ACCOUNT_KIND_ACCEPT_MESSAGE =
  "This request cannot be accepted. Demo accounts and members cannot be connected with each other.";

export function isAccountKindRefusal(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23514" && error.message === ACCOUNT_KIND_REFUSAL;
}

export async function updateMentorshipRequest(
  getClient: () => Promise<SupabaseClient>,
  requestId: string,
  decision: Decision | null,
): Promise<RequestState> {
  if (!requestId || !decision) {
    return { error: "Choose a valid request action and try again.", ok: false };
  }

  const failed = {
    error: `We couldn't ${decision} this request. Please try again.`,
    ok: false,
  };
  const unavailable = {
    error: "This request is no longer pending or available to you. Refresh the page to see its latest status.",
    ok: false,
  };

  try {
    const supabase = await getClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Please sign in again before updating this request.", ok: false };
    }

    if (decision === "cancel") {
      // Keep RLS in force and detect a stale or inaccessible request, including
      // updates that succeed at the HTTP level but affect no rows.
      const { data, error } = await supabase
        .from("mentorship_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("mentee_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) return failed;
      if (!data) return unavailable;
    } else {
      // The existing RPC checks the recipient and pending status, and creates
      // the connection atomically when accepting.
      const { error } = await supabase.rpc("respond_to_request", {
        p_request_id: requestId,
        p_accept: decision === "accept",
      });
      if (error) {
        if (isAccountKindRefusal(error)) return { error: ACCOUNT_KIND_ACCEPT_MESSAGE, ok: false };
        if (error.code === "P0001" && [
          "request not found",
          "request is not pending",
          "only the recipient mentor can respond",
          "cannot accept request between blocked participants",
        ].includes(error.message)) return unavailable;
        return failed;
      }
    }

    return { error: null, ok: true };
  } catch {
    return failed;
  }
}
