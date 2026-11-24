import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CROSS_ORIGIN_ERROR, isSameOriginRequest, rejectCrossOrigin } from "./request-origin.ts";

const headers = (values) => new Headers(values);

test("a POST from the app's own page is allowed", () => {
  assert.equal(isSameOriginRequest(headers({ origin: "https://alumnikonneqt.com", host: "alumnikonneqt.com" })), true);
  assert.equal(isSameOriginRequest(headers({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" })), true);
  assert.equal(isSameOriginRequest(headers({ origin: "https://AlumniKonneQt.com", host: "alumnikonneqt.com" })), true);
});

test("behind a proxy the forwarded host is the app's host", () => {
  const forwarded = { origin: "https://alumnikonneqt.com", host: "internal.vercel.test", "x-forwarded-host": "alumnikonneqt.com" };
  assert.equal(isSameOriginRequest(headers(forwarded)), true);
  assert.equal(isSameOriginRequest(headers({ ...forwarded, "x-forwarded-host": "alumnikonneqt.com, proxy.test" })), true);
  assert.equal(isSameOriginRequest(headers({ ...forwarded, origin: "https://internal.vercel.test" })), false);
});

test("a POST from another site is rejected", () => {
  for (const origin of ["https://evil.example", "https://alumnikonneqt.com.evil.example", "http://alumnikonneqt.com:8080"]) {
    assert.equal(isSameOriginRequest(headers({ origin, host: "alumnikonneqt.com" })), false, origin);
  }
});

test("an opaque or malformed origin is rejected", () => {
  for (const origin of ["null", "", "not a url"]) {
    assert.equal(isSameOriginRequest(headers({ origin, host: "alumnikonneqt.com" })), false, origin);
  }
});

test("an origin is rejected when the app's own host is unknown", () => {
  assert.equal(isSameOriginRequest(headers({ origin: "https://alumnikonneqt.com" })), false);
});

test("without Origin, the browser's Sec-Fetch-Site decides", () => {
  assert.equal(isSameOriginRequest(headers({ host: "alumnikonneqt.com", "sec-fetch-site": "same-origin" })), true);
  assert.equal(isSameOriginRequest(headers({ host: "alumnikonneqt.com", "sec-fetch-site": "none" })), true);
  assert.equal(isSameOriginRequest(headers({ host: "alumnikonneqt.com", "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOriginRequest(headers({ host: "alumnikonneqt.com", "sec-fetch-site": "same-site" })), false);
});

test("a client that sends neither header, such as a test script, is allowed", () => {
  assert.equal(isSameOriginRequest(headers({ host: "127.0.0.1:3000" })), true);
});

test("the rejection is a 403 that is never cached", async () => {
  const response = rejectCrossOrigin(headers({ origin: "https://evil.example", host: "alumnikonneqt.com" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: CROSS_ORIGIN_ERROR });
  assert.equal(rejectCrossOrigin(headers({ origin: "https://alumnikonneqt.com", host: "alumnikonneqt.com" })), null);
});

test("every cookie-authenticated POST route checks the origin before signing in", async () => {
  for (const route of ["embed", "match", "match/compare", "cv/extract"]) {
    const source = await readFile(new URL(`../app/api/${route}/route.ts`, import.meta.url), "utf8");
    const check = source.indexOf("rejectCrossOrigin(request.headers)");
    assert.ok(check > 0, `${route} does not check the origin`);
    assert.ok(check < source.indexOf("auth.getUser()"), `${route} checks the origin after reading the session`);
  }
});
