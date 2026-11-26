// Where focus goes when the control that opened a dialog is removed while the
// dialog is open, for example when blocking a member removes their card
// (#147, WCAG 2.4.3). Kept free of React and DOM imports so it can be unit tested.

interface Connectable {
  isConnected: boolean;
}

/**
 * Remembers the controls around `current` (in document order) and returns a
 * picker for later: the nearest one after it that still exists, otherwise the
 * nearest one before it, otherwise null.
 */
export function successorPicker<T extends Connectable>(all: readonly T[], current: T): () => T | null {
  const index = all.indexOf(current);
  const after = index < 0 ? [] : all.slice(index + 1);
  const before = index < 0 ? [] : all.slice(0, index).reverse();
  return () => after.find((item) => item.isConnected) ?? before.find((item) => item.isConnected) ?? null;
}
