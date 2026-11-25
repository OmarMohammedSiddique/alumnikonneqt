import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_TURNSTILE_STATUS,
  TURNSTILE_STATUS_MESSAGE,
  TURNSTILE_WAITING_MESSAGE,
  nextTurnstileStatus,
  shouldHoldSubmit,
} from "./turnstile-status.ts";

const STATUSES = ["checking", "verified", "failed", "expired"];

test("the check starts as checking", () => {
  assert.equal(INITIAL_TURNSTILE_STATUS, "checking");
});

test("a token marks the visitor as verified from any status", () => {
  for (const status of STATUSES) {
    assert.equal(nextTurnstileStatus(status, { type: "token", token: "XXXX.DUMMY.TOKEN" }), "verified");
  }
});

test("an empty token does not count as verified", () => {
  assert.equal(nextTurnstileStatus("checking", { type: "token", token: "" }), "checking");
  assert.equal(nextTurnstileStatus("verified", { type: "token", token: "" }), "checking");
});

test("widget errors and script load failures mark the check as failed", () => {
  for (const status of STATUSES) {
    assert.equal(nextTurnstileStatus(status, { type: "error" }), "failed");
    assert.equal(nextTurnstileStatus(status, { type: "load-error" }), "failed");
  }
});

test("expired and timed out tokens mark the check as expired", () => {
  assert.equal(nextTurnstileStatus("verified", { type: "expired" }), "expired");
  assert.equal(nextTurnstileStatus("checking", { type: "timeout" }), "expired");
});

test("a fresh token after expiry verifies again", () => {
  const expired = nextTurnstileStatus("verified", { type: "expired" });
  assert.equal(nextTurnstileStatus(expired, { type: "token", token: "fresh" }), "verified");
});

test("every reset returns to checking", () => {
  for (const status of STATUSES) {
    assert.equal(nextTurnstileStatus(status, { type: "reset" }), "checking");
  }
});

test("unknown events leave the status unchanged", () => {
  assert.equal(nextTurnstileStatus("verified", { type: "unknown" }), "verified");
});

test("every status has visible copy without em dashes or double hyphens", () => {
  assert.deepEqual(Object.keys(TURNSTILE_STATUS_MESSAGE).sort(), [...STATUSES].sort());
  for (const message of Object.values(TURNSTILE_STATUS_MESSAGE)) {
    assert.ok(message.length > 0);
    assert.doesNotMatch(message, /—|--/);
  }
});

test("a form with an empty token field is held while the check runs", () => {
  assert.equal(shouldHoldSubmit(true, "checking", { value: "" }), true);
  assert.equal(shouldHoldSubmit(true, "expired", { value: "" }), true);
});

test("a form whose token has arrived is sent straight away", () => {
  assert.equal(shouldHoldSubmit(true, "verified", { value: "token-from-cloudflare" }), false);
});

test("nothing is held once the check has failed, so the server can answer", () => {
  assert.equal(shouldHoldSubmit(true, "failed", { value: "" }), false);
});

test("forms without a token field are never held", () => {
  assert.equal(shouldHoldSubmit(true, "checking", null), false);
});

test("nothing is held when no site key is configured", () => {
  assert.equal(shouldHoldSubmit(false, "checking", { value: "" }), false);
});

test("the waiting message tells the visitor the request will follow", () => {
  assert.match(TURNSTILE_WAITING_MESSAGE, /sent as soon as the check finishes/);
  assert.doesNotMatch(TURNSTILE_WAITING_MESSAGE, /\u2014|--/);
});
