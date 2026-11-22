import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ENFORCED_CONTENT_SECURITY_POLICY,
  buildReportOnlyContentSecurityPolicy,
  buildSecurityHeaders,
} from "./security-headers.ts";

const PRODUCTION = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@o0.ingest.example.test/0",
};

function header(headers, key) {
  return headers.find((entry) => entry.key === key)?.value;
}

test("every response carries the baseline security headers", () => {
  const headers = buildSecurityHeaders(PRODUCTION);
  assert.equal(header(headers, "X-Content-Type-Options"), "nosniff");
  assert.equal(header(headers, "X-Frame-Options"), "DENY");
  assert.equal(header(headers, "Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(header(headers, "Strict-Transport-Security"), /max-age=63072000; includeSubDomains/);
  assert.match(header(headers, "Permissions-Policy"), /camera=\(\), microphone=\(\), geolocation=\(\)/);
});

test("the enforced policy forbids framing and holds nothing that can break a page", () => {
  const headers = buildSecurityHeaders(PRODUCTION);
  assert.equal(header(headers, "Content-Security-Policy"), ENFORCED_CONTENT_SECURITY_POLICY);
  assert.match(ENFORCED_CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.doesNotMatch(ENFORCED_CONTENT_SECURITY_POLICY, /script-src|default-src/);
});

test("the report-only policy allows only the services the site uses", () => {
  const policy = buildReportOnlyContentSecurityPolicy(PRODUCTION);
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self' 'unsafe-inline' https:\/\/challenges\.cloudflare\.com;/);
  assert.match(
    policy,
    /connect-src 'self' https:\/\/project\.example\.test wss:\/\/project\.example\.test https:\/\/o0\.ingest\.example\.test;/,
  );
  assert.match(policy, /img-src 'self' data: blob: https:\/\/project\.example\.test;/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /public@/);
});

test("development allows eval for React debugging and tolerates missing settings", () => {
  const policy = buildReportOnlyContentSecurityPolicy({ NODE_ENV: "development" });
  assert.match(policy, /'unsafe-eval'/);
  assert.match(policy, /connect-src 'self';/);
});

test("a malformed service URL is left out rather than copied into the policy", () => {
  const policy = buildReportOnlyContentSecurityPolicy({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
    NEXT_PUBLIC_SENTRY_DSN: "not a url; script-src *",
  });
  assert.match(policy, /connect-src 'self';/);
  assert.doesNotMatch(policy, /script-src \*/);
});
