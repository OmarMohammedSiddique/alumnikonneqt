// HTTP security headers sent with every response (launch review, check 22).
// Pure so it can be unit tested; next.config.ts passes in the build environment.
//
// Two content security policies are sent:
// - an enforced one holding only the directives that cannot break a page
//   (framing, <base> and plugins);
// - a fuller one in report-only mode, which browsers log but do not enforce,
//   so it can be tightened and then enforced once the console stays clean.

type Env = Record<string, string | undefined>;

export interface SecurityHeader {
  key: string;
  value: string;
}

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export const ENFORCED_CONTENT_SECURITY_POLICY =
  "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

export function buildReportOnlyContentSecurityPolicy(env: Env): string {
  const isDev = env.NODE_ENV !== "production";
  const supabase = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseRealtime = supabase?.replace(/^http/, "ws");
  const sentry = originOf(env.NEXT_PUBLIC_SENTRY_DSN ?? env.SENTRY_DSN);

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // 'unsafe-inline' is needed for the theme bootstrap script and the inline
    // scripts Next.js emits; removing it means moving to nonces.
    [
      "script-src",
      unique(["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : undefined, TURNSTILE_ORIGIN]),
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", unique(["'self'", "data:", "blob:", supabase])],
    ["font-src", ["'self'"]],
    ["connect-src", unique(["'self'", supabase, supabaseRealtime, sentry])],
    ["frame-src", [TURNSTILE_ORIGIN]],
    ["worker-src", ["'self'", "blob:"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
  ];

  return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

export function buildSecurityHeaders(env: Env): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: ENFORCED_CONTENT_SECURITY_POLICY },
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildReportOnlyContentSecurityPolicy(env),
    },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The site uses none of these device features.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
  ];
}
