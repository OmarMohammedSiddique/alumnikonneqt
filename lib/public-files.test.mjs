import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import robots, { ROBOTS_DISALLOW } from "../app/robots.ts";

test("robots.txt allows public pages and keeps signed-in areas out of search", () => {
  const { rules } = robots();
  assert.equal(rules.userAgent, "*");
  assert.equal(rules.allow, "/");
  for (const path of ["/api/", "/admin", "/discover", "/profile", "/requests", "/demo"]) {
    assert.ok(ROBOTS_DISALLOW.includes(path), path);
  }
  for (const path of ["/", "/about", "/privacy", "/login", "/signup"]) {
    assert.ok(!ROBOTS_DISALLOW.includes(path), path);
  }
});

test("security.txt names a contact and expires within a year (RFC 9116)", async () => {
  const text = await readFile(new URL("../public/.well-known/security.txt", import.meta.url), "utf8");
  const field = (name) => text.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1];
  assert.match(field("Contact"), /^https:\/\//);
  const expires = new Date(field("Expires"));
  assert.ok(!Number.isNaN(expires.getTime()), "Expires is a date");
  const written = new Date("2026-11-24T00:00:00.000Z");
  assert.ok(expires > written, "Expires is in the future");
  assert.ok(expires - written <= 366 * 24 * 60 * 60 * 1000, "Expires is no more than a year ahead");
  assert.equal(field("Canonical"), "https://alumnikonneqt.com/.well-known/security.txt");
});
