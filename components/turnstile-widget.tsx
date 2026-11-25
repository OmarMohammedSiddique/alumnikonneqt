"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle, RotateCw, ShieldCheck, type LucideIcon } from "lucide-react";
import { CAPTCHA_FIELD } from "@/lib/turnstile";
import {
  INITIAL_TURNSTILE_STATUS,
  TURNSTILE_STATUS_MESSAGE,
  nextTurnstileStatus,
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

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let scriptPromise: Promise<void> | null = null;

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
        callback: (token) => { onTokenRef.current(token); report({ type: "token", token }); },
        "expired-callback": () => { onTokenRef.current(""); report({ type: "expired" }); },
        "timeout-callback": () => { onTokenRef.current(""); report({ type: "timeout" }); },
        "error-callback": () => { onTokenRef.current(""); report({ type: "error" }); },
      });
    }).catch(() => { onTokenRef.current(""); report({ type: "load-error" }); });
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = undefined;
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
