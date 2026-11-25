import assert from "node:assert/strict";
import test from "node:test";
import { SUPPORT_EMAIL, supportMailto } from "./site.ts";

test("the support address is on the project domain", () => {
  assert.equal(SUPPORT_EMAIL, "support@alumnikonneqt.com");
});

test("a bare support link has no query string", () => {
  assert.equal(supportMailto(), "mailto:support@alumnikonneqt.com");
});

test("a subject is percent-encoded into the support link", () => {
  assert.equal(
    supportMailto("Privacy and data"),
    "mailto:support@alumnikonneqt.com?subject=Privacy%20and%20data",
  );
  assert.equal(
    supportMailto("Help & feedback?"),
    "mailto:support@alumnikonneqt.com?subject=Help%20%26%20feedback%3F",
  );
});
