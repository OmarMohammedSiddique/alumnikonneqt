// Visible state of the Cloudflare Turnstile check on the auth forms.
// The widget runs in "interaction-only" mode, so most visitors never see it;
// this status lets them know whether the check is running, passed or failed.

export type TurnstileStatus = "checking" | "verified" | "failed" | "expired";

export type TurnstileEvent =
  | { type: "token"; token: string }
  | { type: "error" }
  | { type: "load-error" }
  | { type: "expired" }
  | { type: "timeout" }
  | { type: "reset" };

export const INITIAL_TURNSTILE_STATUS: TurnstileStatus = "checking";

export const TURNSTILE_STATUS_MESSAGE: Record<TurnstileStatus, string> = {
  checking: "Checking you're not a bot…",
  verified: "Verified as human by Cloudflare",
  failed: "Verification failed. Refresh the page or try again.",
  expired: "Verification expired, checking again…",
};

export function nextTurnstileStatus(current: TurnstileStatus, event: TurnstileEvent): TurnstileStatus {
  switch (event.type) {
    case "token":
      return event.token ? "verified" : "checking";
    case "error":
    case "load-error":
      return "failed";
    case "expired":
    case "timeout":
      return "expired";
    case "reset":
      return "checking";
    default:
      return current;
  }
}

// A form that carries a token field is held while its token is still on the way:
// once Supabase enforces the check it would reject the request, and the visitor
// would have to wait for a new token. When the check has failed nothing is held,
// so the server can answer instead of the click being swallowed.
export function shouldHoldSubmit(siteKeyConfigured: boolean, status: TurnstileStatus, tokenField: { value: string } | null): boolean {
  return siteKeyConfigured && status !== "failed" && tokenField !== null && tokenField.value.length === 0;
}

export const TURNSTILE_WAITING_MESSAGE = "Your request will be sent as soon as the check finishes.";
