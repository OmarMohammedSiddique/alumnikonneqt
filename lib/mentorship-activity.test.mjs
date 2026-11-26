import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUEST_STATUSES,
  UNAVAILABLE_MEMBER,
  awaitingFirstConversation,
  formatActivityDate,
  safeCount,
  summariseRequestStatuses,
  toRecentConnections,
} from "./mentorship-activity.ts";

test("lists every request status in schema order, with zero for missing counts", () => {
  const { rows, total } = summariseRequestStatuses({});
  assert.deepEqual(rows.map((row) => row.status), [...REQUEST_STATUSES]);
  assert.deepEqual(rows.map((row) => row.label), ["Pending", "Accepted", "Declined", "Cancelled"]);
  assert.ok(rows.every((row) => row.count === 0));
  assert.equal(total, 0);
});

test("totals the counts and treats null, negative or invalid counts as zero", () => {
  const { rows, total } = summariseRequestStatuses({ pending: 3, accepted: 2, declined: null, cancelled: -1 });
  assert.deepEqual(rows.map((row) => row.count), [3, 2, 0, 0]);
  assert.equal(total, 5);
  assert.equal(safeCount(undefined), 0);
  assert.equal(safeCount(Number.NaN), 0);
  assert.equal(safeCount(Number.POSITIVE_INFINITY), 0);
  assert.equal(safeCount(4.7), 4);
});

test("returns the five newest connections with names only", () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    id: `c${i}`,
    created_at: `2026-11-0${i + 1}T10:00:00Z`,
    mentee: { full_name: `Mentee ${i}`, headline: "not shown", bio: "not shown" },
    mentor: [{ full_name: `Mentor ${i}`, contact: "not shown" }],
    message: "not shown",
  }));
  const recent = toRecentConnections(rows);
  assert.deepEqual(recent.map((row) => row.id), ["c6", "c5", "c4", "c3", "c2"]);
  assert.deepEqual(recent[0], {
    id: "c6",
    menteeName: "Mentee 6",
    mentorName: "Mentor 6",
    connectedAt: "2026-11-07T10:00:00Z",
  });
  assert.deepEqual(Object.keys(recent[0]).sort(), ["connectedAt", "id", "menteeName", "mentorName"]);
});

test("falls back to a neutral label when a member's name is missing", () => {
  const recent = toRecentConnections([
    { id: "a", created_at: "2026-11-01T00:00:00Z", mentee: null, mentor: { full_name: "   " } },
    { id: "b", created_at: "2026-11-02T00:00:00Z", mentee: [], mentor: undefined },
  ]);
  assert.deepEqual(recent.map((row) => [row.menteeName, row.mentorName]), [
    [UNAVAILABLE_MEMBER, UNAVAILABLE_MEMBER],
    [UNAVAILABLE_MEMBER, UNAVAILABLE_MEMBER],
  ]);
});

test("handles no connections at all", () => {
  assert.deepEqual(toRecentConnections(null), []);
  assert.deepEqual(toRecentConnections([]), []);
  assert.deepEqual(toRecentConnections([{ id: "a", created_at: "2026-11-01T00:00:00Z", mentee: null, mentor: null }], 0), []);
});

test("formats dates in Kenyan time and survives bad input", () => {
  assert.equal(formatActivityDate("2026-11-25T22:30:00Z"), "26 Nov 2026");
  assert.equal(formatActivityDate("not a date"), "Date unavailable");
});

test("counts connections still waiting for a first conversation", () => {
  assert.equal(awaitingFirstConversation(5, 2), 3);
  assert.equal(awaitingFirstConversation(0, 0), 0);
  assert.equal(awaitingFirstConversation(null, undefined), 0);
  assert.equal(awaitingFirstConversation(1, 3), 0);
});

test("keeps a stable order when a date cannot be parsed", () => {
  const recent = toRecentConnections([
    { id: "bad", created_at: "not a date", mentee: null, mentor: null },
    { id: "new", created_at: "2026-11-02T00:00:00Z", mentee: null, mentor: null },
  ]);
  assert.deepEqual(recent.map((row) => row.id), ["new", "bad"]);
});
