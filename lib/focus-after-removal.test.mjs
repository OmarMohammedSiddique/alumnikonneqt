import assert from "node:assert/strict";
import test from "node:test";
import { successorPicker } from "./focus-after-removal.ts";

const controls = (...names) => names.map((name) => ({ name, isConnected: true }));

test("focus moves to the next remaining card's control", () => {
  const [a, b, c] = controls("a", "b", "c");
  const pick = successorPicker([a, b, c], b);
  b.isConnected = false;
  assert.equal(pick(), c);
});

test("controls removed with the card are skipped", () => {
  // In the model comparison the same mentor appears in both columns.
  const [a, b, bAgain, c] = controls("a", "b", "b-again", "c");
  const pick = successorPicker([a, b, bAgain, c], b);
  b.isConnected = false;
  bAgain.isConnected = false;
  assert.equal(pick(), c);
});

test("blocking the last card moves focus to the one before it", () => {
  const [a, b, c] = controls("a", "b", "c");
  const pick = successorPicker([a, b, c], c);
  c.isConnected = false;
  assert.equal(pick(), b);
});

test("with no card left there is no control to focus", () => {
  const [only] = controls("only");
  const pick = successorPicker([only], only);
  only.isConnected = false;
  assert.equal(pick(), null);
});

test("an unknown control has no neighbours", () => {
  const [a] = controls("a");
  assert.equal(successorPicker([a], { isConnected: false })(), null);
});
