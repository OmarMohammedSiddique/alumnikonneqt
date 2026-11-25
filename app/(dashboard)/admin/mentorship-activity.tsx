import type { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";
import {
  REQUEST_STATUSES,
  awaitingFirstConversation,
  formatActivityDate,
  safeCount,
  summariseRequestStatuses,
  toRecentConnections,
  type RecentConnection,
  type RecentConnectionRow,
  type StatusCount,
} from "@/lib/mentorship-activity";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface MentorshipActivityData {
  failed: boolean;
  statuses: StatusCount[];
  totalRequests: number;
  connections: number;
  firstConversations: number;
  awaitingFirstConversation: number;
  menteesWithMatchProfile: number;
  mentorsWithMatchProfile: number;
  recent: RecentConnection[];
}

// Read-only. Runs as the signed-in staff member, so row-level security decides
// what is returned: the existing "parties and staff read" policies on
// mentorship_requests and connections, and the staff clause on profiles, let
// moderators and admins read every row. Counts use head requests, so no rows
// are transferred; the recent list selects names and dates only.
export async function loadMentorshipActivity(supabase: ServerClient): Promise<MentorshipActivityData> {
  const countRequests = (status: (typeof REQUEST_STATUSES)[number]) =>
    supabase.from("mentorship_requests").select("id", { count: "exact", head: true }).eq("status", status);
  const countMatchProfiles = (role: "mentee" | "mentor") =>
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", role)
      .not("embedding", "is", null);

  const [statusResults, connections, firstConversations, mentees, mentors, recent] = await Promise.all([
    Promise.all(REQUEST_STATUSES.map(countRequests)),
    supabase.from("connections").select("id", { count: "exact", head: true }),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .not("first_conversation_at", "is", null),
    countMatchProfiles("mentee"),
    countMatchProfiles("mentor"),
    supabase
      .from("connections")
      .select(
        `id, created_at,
         mentee:profiles!connections_mentee_id_fkey(full_name),
         mentor:profiles!connections_mentor_id_fkey(full_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<RecentConnectionRow[]>(),
  ]);

  const failed = [...statusResults, connections, firstConversations, mentees, mentors, recent].some(
    (result) => result.error,
  );
  const { rows, total } = summariseRequestStatuses(
    Object.fromEntries(REQUEST_STATUSES.map((status, i) => [status, statusResults[i].count])),
  );

  return {
    failed,
    statuses: rows,
    totalRequests: total,
    connections: safeCount(connections.count),
    firstConversations: safeCount(firstConversations.count),
    awaitingFirstConversation: awaitingFirstConversation(connections.count, firstConversations.count),
    menteesWithMatchProfile: safeCount(mentees.count),
    mentorsWithMatchProfile: safeCount(mentors.count),
    recent: toRecentConnections(recent.data),
  };
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card size="sm" className="gap-1 px-(--card-spacing)">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-medium tabular-nums">{value.toLocaleString("en-GB")}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </Card>
  );
}

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3";

export function MentorshipActivity({ data }: { data: MentorshipActivityData }) {
  return (
    <section aria-labelledby="mentorship-activity-heading">
      <h2 id="mentorship-activity-heading" className="mb-1 text-xl font-medium">
        Mentorship activity
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        A read-only summary of requests and connections across the platform.
      </p>

      {data.failed ? (
        <StatusMessage tone="error">
          Mentorship activity could not be loaded just now. Refresh the page to try again.
        </StatusMessage>
      ) : (
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">
              Requests by status{" "}
              <span className="font-normal text-muted-foreground">
                ({data.totalRequests.toLocaleString("en-GB")} in total)
              </span>
            </h3>
            <dl className={GRID}>
              {data.statuses.map((row) => (
                <Stat key={row.status} label={row.label} value={row.count} />
              ))}
            </dl>
            {data.totalRequests === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No mentorship requests yet. Counts will appear here once Mentees start sending requests.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Connections and matching</h3>
            <dl className={GRID}>
              <Stat label="Active connections" value={data.connections} note="Pairs connected so far" />
              <Stat label="First conversations held" value={data.firstConversations} note="Marked by either person" />
              <Stat label="Awaiting a first conversation" value={data.awaitingFirstConversation} note="Connected, not yet marked as held" />
              <Stat label="Mentees with a matching profile" value={data.menteesWithMatchProfile} />
              <Stat label="Mentors with a matching profile" value={data.mentorsWithMatchProfile} />
            </dl>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Most recent connections</h3>
            <div className="workspace-table-wrap" role="region" aria-label="Most recent connections table" tabIndex={0}>
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th scope="col">Mentee</th>
                    <th scope="col">Mentor</th>
                    <th scope="col">Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((row) => (
                    <tr key={row.id}>
                      <td>{row.menteeName}</td>
                      <td>{row.mentorName}</td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        <time dateTime={row.connectedAt}>{formatActivityDate(row.connectedAt)}</time>
                      </td>
                    </tr>
                  ))}
                  {!data.recent.length && (
                    <tr>
                      <td colSpan={3} className="text-muted-foreground">
                        No connections yet. When a Mentor accepts a request, the pair will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
