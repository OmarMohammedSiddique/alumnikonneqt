// Public contact details for the project, defined once so every surface agrees.

/** Project support inbox. Delivered by email forwarding on the root domain (#134). */
export const SUPPORT_EMAIL = "support@alumnikonneqt.com";

/** A mailto link to the support inbox, optionally with a subject line filled in. */
export function supportMailto(subject?: string): string {
  return subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}
