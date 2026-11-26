// Pure helpers for the read-only "Mentorship activity" summary on the
// administration page. The page fetches counts and names; these functions only
// shape them for display, so they can be tested without a database.

// Mirrors the public.request_status enum in the initial schema migration.
export const REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
export type RequestStatusKey = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatusKey, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

export interface StatusCount {
  status: RequestStatusKey;
  label: string;
  count: number;
}

/** A count from PostgREST is null when it could not be computed; show it as zero. */
export function safeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/** Every known status in a fixed order, so empty statuses still show as zero. */
export function summariseRequestStatuses(
  counts: Partial<Record<RequestStatusKey, number | null | undefined>>,
): { rows: StatusCount[]; total: number } {
  const rows = REQUEST_STATUSES.map((status) => ({
    status,
    label: REQUEST_STATUS_LABELS[status],
    count: safeCount(counts[status]),
  }));
  return { rows, total: rows.reduce((sum, row) => sum + row.count, 0) };
}

/**
 * Connections still before the "First conversation" journey stage. Staff can
 * read first_conversation_at on connections, but not the private
 * connection_contacts rows, so "Contact shared" is not split out here.
 */
export function awaitingFirstConversation(
  connections: number | null | undefined,
  firstConversations: number | null | undefined,
): number {
  return Math.max(0, safeCount(connections) - safeCount(firstConversations));
}

type NameRelation = { full_name: string | null } | { full_name: string | null }[] | null | undefined;

export interface RecentConnectionRow {
  id: string;
  created_at: string;
  mentee: NameRelation;
  mentor: NameRelation;
}

export interface RecentConnection {
  id: string;
  menteeName: string;
  mentorName: string;
  connectedAt: string;
}

export const UNAVAILABLE_MEMBER = "Unavailable member";

function nameOf(relation: NameRelation): string {
  const profile = Array.isArray(relation) ? relation[0] : relation;
  const name = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  return name || UNAVAILABLE_MEMBER;
}

/** Newest first, names only: no contact details, bios or request messages. */
export function toRecentConnections(rows: RecentConnectionRow[] | null | undefined, limit = 5): RecentConnection[] {
  return [...(rows ?? [])]
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
    .slice(0, Math.max(0, limit))
    .map((row) => ({
      id: row.id,
      menteeName: nameOf(row.mentee),
      mentorName: nameOf(row.mentor),
      connectedAt: row.created_at,
    }));
}

/** For example "26 Nov 2026", in Kenyan time so the server's zone does not matter. */
export function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
}
