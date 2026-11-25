"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preconnect, preload } from "react-dom";
import { CircleAlert, LoaderCircle, RotateCw, ShieldCheck, type LucideIcon } from "lucide-react";
import { CAPTCHA_FIELD } from "@/lib/turnstile";
import {
  INITIAL_TURNSTILE_STATUS,
  TURNSTILE_STATUS_MESSAGE,
  TURNSTILE_WAITING_MESSAGE,
  nextTurnstileStatus,
  shouldHoldSubmit,
  type TurnstileEvent,
  type TurnstileStatus,
} from "@/lib/turnstile-status";

type RenderOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => boolean | void;
  "timeout-callback"?: () => void;
  "retry-interval"?: number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: RenderOptions) => string | undefined;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const SCRIPT_SRC = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
// Cloudflare retries a failed attempt after 8 seconds by default.
const RETRY_INTERVAL_MS = 2500;
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let scriptPromise: Promise<void> | null = null;
// Only one widget on a page holds submissions, so a form is never queued twice.
// Every auth page has a single widget; a page with two would follow the first one's status.
let holdOwner: object | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; script.remove(); reject(new Error("Turnstile unavailable")); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Renders Cloudflare Turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, and
 * reports the current single-use token. Pass the latest server-action result as
 * `resetKey` so each submission gets a fresh token. Renders nothing when the
 * site key is not configured, so local development keeps working unchanged.
 */
export function TurnstileWidget({ action, onToken, resetKey }: { action: string; onToken: (token: string) => void; resetKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });
  const [status, setStatus] = useState<TurnstileStatus>(INITIAL_TURNSTILE_STATUS);
  const report = useCallback((event: TurnstileEvent) => setStatus((current) => nextTurnstileStatus(current, event)), []);
  // A submission made before the token arrived, sent again once it does.
  const queued = useRef<{ form: HTMLFormElement; submitter: HTMLElement | null } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; });

  if (TURNSTILE_SITE_KEY) {
    // Start the connection and the script download with the page, not after hydration.
    preconnect(TURNSTILE_ORIGIN);
    preload(SCRIPT_SRC, { as: "script" });
  }

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || holdOwner) return;
    const owner = {};
    holdOwner = owner;
    // Capture phase on the document runs before React handles the submission,
    // so a form without its token is held here instead of being rejected by Supabase.
    const hold = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const tokenField = form.querySelector<HTMLInputElement>(`input[name="${CAPTCHA_FIELD}"]`);
      if (!shouldHoldSubmit(Boolean(TURNSTILE_SITE_KEY), statusRef.current, tokenField)) return;
      event.preventDefault();
      event.stopPropagation();
      queued.current = { form, submitter: event.submitter };
      setWaiting(true);
    };
    document.addEventListener("submit", hold, true);
    return () => {
      document.removeEventListener("submit", hold, true);
      if (holdOwner === owner) holdOwner = null;
    };
  }, []);

  // Send the held submission once the token is in the form. This runs after the
  // parent has re-rendered with the token, so the hidden field is already filled.
  // If the check fails instead, send it at once so the visitor gets the server's answer
  // now rather than an unexpected submission later.
  useEffect(() => {
    if ((status !== "verified" && status !== "failed") || !queued.current) return;
    const { form, submitter } = queued.current;
    queued.current = null;
    setWaiting(false);
    if (!form.isConnected) return;
    const button = submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : null;
    if (button && button.isConnected && button.form === form) form.requestSubmit(button);
    else form.requestSubmit();
  }, [status]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        size: "flexible",
        // Most visitors pass silently; a checkbox appears only when Cloudflare needs one.
        appearance: "interaction-only",
        "retry-interval": RETRY_INTERVAL_MS,
        callback: (token) => { onTokenRef.current(token); report({ type: "token", token }); },
        "expired-callback": () => { onTokenRef.current(""); report({ type: "expired" }); },
        "timeout-callback": () => { onTokenRef.current(""); report({ type: "timeout" }); },
        "error-callback": () => { onTokenRef.current(""); report({ type: "error" }); },
      });
    }).catch(() => { if (cancelled) return; onTokenRef.current(""); report({ type: "load-error" }); });
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = undefined;
      // A re-rendered widget starts a fresh check.
      report({ type: "reset" });
    };
  }, [action, report]);

  // Tokens are single-use: after every server response, request a new one.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    if (!widgetRef.current || !window.turnstile) return;
    onTokenRef.current("");
    report({ type: "reset" });
    window.turnstile.reset(widgetRef.current);
  }, [resetKey, report]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div className="grid gap-1">
      <div ref={containerRef} />
      <TurnstileStatusLine status={status} />
      <p role="status" className="text-xs text-muted-foreground">{waiting ? TURNSTILE_WAITING_MESSAGE : ""}</p>
    </div>
  );
}

const STATUS_ICON: Record<TurnstileStatus, { Icon: LucideIcon; iconClassName: string; textClassName: string }> = {
  checking: { Icon: LoaderCircle, iconClassName: "motion-safe:animate-spin", textClassName: "text-muted-foreground" },
  verified: { Icon: ShieldCheck, iconClassName: "", textClassName: "font-medium text-foreground" },
  failed: { Icon: CircleAlert, iconClassName: "", textClassName: "font-medium text-destructive" },
  expired: { Icon: RotateCw, iconClassName: "", textClassName: "text-muted-foreground" },
};

/** Live, text-first status of the bot check; the icon and colour only reinforce the words. */
function TurnstileStatusLine({ status }: { status: TurnstileStatus }) {
  const { Icon, iconClassName, textClassName } = STATUS_ICON[status];
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-turnstile-status={status} className={`inline-flex items-center gap-1.5 text-xs ${textClassName}`}>
      <Icon className={`size-3.5 shrink-0 ${iconClassName}`} aria-hidden="true" />
      {TURNSTILE_STATUS_MESSAGE[status]}
    </div>
  );
}

/** Hidden field carrying the Turnstile token into a server-action form. */
export function CaptchaTokenInput({ token }: { token: string }) {
  return <input type="hidden" name={CAPTCHA_FIELD} value={token} />;
}
