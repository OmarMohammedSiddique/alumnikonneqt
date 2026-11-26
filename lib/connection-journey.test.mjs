import assert from "node:assert/strict";
import test from "node:test";
import {
  contactHref,
  getJourneyProgress,
  getNextStep,
  normaliseContact,
} from "./connection-journey.ts";

test("pending requests sit at the Requested stage", () => {
  assert.deepEqual(getJourneyProgress({ requestStatus: "pending" }), {
    current: "requested", completed: [], ended: null,
  });
});

test("declined and cancelled requests end after Requested", () => {
  for (const status of ["declined", "cancelled"]) {
    assert.deepEqual(getJourneyProgress({ requestStatus: status }), {
      current: null, completed: ["requested"], ended: status,
    });
  }
});

test("accepted connections move through contact, conversation and ongoing", () => {
  assert.equal(getJourneyProgress({ requestStatus: "accepted" }).current, "contact");
  assert.equal(getJourneyProgress({ requestStatus: "accepted", myContact: "a@b.test" }).current, "conversation");
  assert.equal(getJourneyProgress({ requestStatus: "accepted", partnerContact: "a@b.test" }).current, "conversation");
  const held = getJourneyProgress({ requestStatus: "accepted", firstConversationAt: "2026-11-16T10:00:00Z" });
  assert.equal(held.current, "ongoing");
  assert.deepEqual(held.completed, ["requested", "accepted", "contact", "conversation"]);
});

test("each side is told who acts next on a pending request", () => {
  const mentee = getNextStep({ requestStatus: "pending", viewer: "mentee", partnerName: "Grace" });
  const mentor = getNextStep({ requestStatus: "pending", viewer: "mentor", partnerName: "Career Explorer" });
  assert.match(mentee.title, /Waiting for Grace/);
  assert.match(mentee.body, /cancel/);
  assert.equal(mentor.title, "Your response is needed");
  assert.match(mentor.body, /Career Explorer/);
});

test("guidance changes once the other person shares their contact", () => {
  const waiting = getNextStep({ requestStatus: "accepted", viewer: "mentee", partnerName: "Grace", myContact: "me@x.test" });
  assert.equal(waiting.title, "Waiting for Grace");
  const ready = getNextStep({ requestStatus: "accepted", viewer: "mentee", partnerName: "Grace", partnerContact: "grace@x.test" });
  assert.equal(ready.title, "Arrange your first conversation");
  assert.match(ready.body, /mark it as held/);
});

test("ended requests explain the outcome to both people", () => {
  assert.equal(getNextStep({ requestStatus: "declined", viewer: "mentee", partnerName: "Grace" }).title, "Not this time");
  assert.equal(getNextStep({ requestStatus: "declined", viewer: "mentor", partnerName: "Sam" }).title, "You declined this request");
  assert.equal(getNextStep({ requestStatus: "cancelled", viewer: "mentor", partnerName: "Sam" }).title, "Request cancelled");
});

test("guidance never prints a blank name", () => {
  const step = getNextStep({ requestStatus: "pending", viewer: "mentee", partnerName: "  " });
  assert.match(step.title, /your Mentor/);
});

test("ongoing guidance reflects the mentorship plan", () => {
  const ongoing = (plan) => getNextStep({
    requestStatus: "accepted", viewer: "mentee", partnerName: "Grace",
    firstConversationAt: "2026-11-16T10:00:00Z", plan,
  });
  assert.match(ongoing(undefined).body, /objectives together in the mentorship plan/);
  assert.match(ongoing({ objectives: 0, objectivesMet: 0, done: 0, total: 0, overdue: 0 }).body, /mentorship plan/);
  assert.match(ongoing({ objectives: 2, objectivesMet: 0, done: 0, total: 0, overdue: 0 }).body, /Break each objective into milestones/);
  const behind = ongoing({ objectives: 2, objectivesMet: 0, done: 1, total: 4, overdue: 2 });
  assert.equal(behind.title, "Your mentorship is under way");
  assert.match(behind.body, /^1 of 4 milestones done\. 2 milestones are past their target dates/);
  assert.match(ongoing({ objectives: 1, objectivesMet: 0, done: 0, total: 1, overdue: 1 }).body, /1 milestone is past its target date/);
  assert.match(ongoing({ objectives: 2, objectivesMet: 1, done: 3, total: 4, overdue: 0 }).body, /^3 of 4 milestones done\. Keep a regular rhythm/);
  assert.equal(ongoing({ objectives: 2, objectivesMet: 2, done: 4, total: 4, overdue: 0 }).title, "Your objectives are met");
});

test("contacts are trimmed and bounded", () => {
  assert.deepEqual(normaliseContact("  grace@example.test "), { ok: true, value: "grace@example.test" });
  assert.equal(normaliseContact("").ok, false);
  assert.equal(normaliseContact("ab").ok, false);
  assert.equal(normaliseContact("x".repeat(201)).ok, false);
  assert.equal(normaliseContact("line\nbreak").ok, false);
  assert.equal(normaliseContact(null).ok, false);
  assert.equal(normaliseContact("grace@example.test\u202e").ok, false, "text direction override");
  assert.equal(normaliseContact("grace\u0085@example.test").ok, false, "C1 control");
});

test("only emails and https links become clickable", () => {
  assert.equal(contactHref("grace@example.test"), "mailto:grace@example.test");
  assert.equal(contactHref("grace@x.test?cc=attacker%40evil.test&subject=Hi"), null, "no injected mail headers");
  assert.equal(contactHref("grace@x.test,other@evil.test"), null, "no extra recipients");
  assert.equal(contactHref("mailto:a@b.test"), null, "no double scheme");
  assert.equal(contactHref("https://meet.example.test/abc"), "https://meet.example.test/abc");
  assert.equal(contactHref("javascript:alert(1)"), null);
  assert.equal(contactHref("http://insecure.example.test"), null);
  assert.equal(contactHref("+254 700 000000"), null);
  assert.equal(contactHref(""), null);
});
