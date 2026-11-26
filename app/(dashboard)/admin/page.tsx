import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { RoleForm, VisibilityForm, ReportReviewForm } from "./admin-controls";
import { REPORT_REASON_LABELS } from "@/lib/profile-privacy";
import { PageHeading } from "@/components/ui/page-heading";
import { MentorshipActivity, loadMentorshipActivity } from "./mentorship-activity";

export const metadata = { title: "Admin - AlumniKonneQt" };

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  is_visible: boolean;
  created_at: string;
}

interface AuditRow {
  id: number;
  action: string;
  target_table: string;
  detail: Record<string, unknown>;
  created_at: string;
}

interface ReportRow {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter_id: string;
  reported_id: string;
  reporter: { full_name: string } | null;
  reported: {
    full_name: string;
    role: string;
    is_visible: boolean;
    staff_hidden: boolean;
  } | null;
}

export default async function AdminPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = me?.role === "admin";
  const isStaff = isAdmin || me?.role === "moderator";
  if (!isStaff) redirect("/discover");

  const [{ data: profiles }, { data: reports }, { data: audit }, activity] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, is_visible, created_at")
        .order("created_at", { ascending: false })
        .returns<ProfileRow[]>(),
      supabase
        .from("reports")
        .select(
          `id, reason, details, status, created_at, reporter_id, reported_id,
           reporter:profiles!reports_reporter_id_fkey(full_name),
           reported:profiles!reports_reported_id_fkey(full_name, role, is_visible, staff_hidden)`,
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<ReportRow[]>(),
      supabase
        .from("audit_logs")
        .select("id, action, target_table, detail, created_at")
        .order("id", { ascending: false })
        .limit(50)
        .returns<AuditRow[]>(),
      loadMentorshipActivity(supabase),
    ]);

  return (
    <div className="grid min-w-0 w-full gap-10 [&>section]:min-w-0">
      <PageHeading title="Administration">
        Follow mentorship across the platform, manage members and review reports.
      </PageHeading>

      <MentorshipActivity data={activity} />

      <section>
        <h2 className="mb-1 text-xl font-medium">User management</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {isAdmin
            ? "Assign roles and moderate profile visibility."
            : "Moderate profile visibility. Role changes require an admin."}
        </p>
        <div className="workspace-table-wrap" role="region" aria-label="User management table" tabIndex={0}>
          <table className="workspace-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Visibility</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.full_name || "(no name)"}
                    {p.id === user.id && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </td>
                  <td>
                    {isAdmin && p.id !== user.id ? (
                      <RoleForm userId={p.id} name={p.full_name || "this user"} role={p.role} />
                    ) : (
                      <span className="capitalize">{p.role}</span>
                    )}
                  </td>
                  <td>
                    {p.id !== user.id ? (
                      <VisibilityForm userId={p.id} name={p.full_name || "this user"} visible={p.is_visible} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {p.is_visible ? "Visible" : "Hidden"}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-medium">Safety & Member Reports</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Pending member reports requiring moderation review.
        </p>
        <div className="workspace-table-wrap" role="region" aria-label="Safety reports table" tabIndex={0}>
          <table className="workspace-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Reported Member</th>
                <th scope="col">Reporter</th>
                <th scope="col">Reason</th>
                <th scope="col">Context</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports?.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted-foreground text-xs">
                    {new Date(r.created_at).toLocaleString("en-GB")}
                  </td>
                  <td>
                    <span className="font-medium">
                      {r.reported?.full_name || "Unknown"}
                    </span>
                    {r.reported?.role && (
                      <span className="ml-1.5 text-xs text-muted-foreground capitalize">
                        ({r.reported.role})
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    {r.reporter?.full_name || "Confidential Member"}
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                      {REPORT_REASON_LABELS[
                        r.reason as keyof typeof REPORT_REASON_LABELS
                      ] || r.reason}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground max-w-xs break-words">
                    {r.details || "(No additional notes provided)"}
                  </td>
                  <td>
                    <ReportReviewForm
                      reportId={r.id}
                      reportedName={r.reported?.full_name || "this member"}
                    />
                  </td>
                </tr>
              ))}
              {!reports?.length && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground">
                    No pending safety reports. Community queue is clean.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-medium">Audit log</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Most recent 50 platform events, written by database triggers.
        </p>
        <div className="workspace-table-wrap" role="region" aria-label="Audit log table" tabIndex={0}>
          <table className="workspace-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit?.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("en-GB")}
                  </td>
                  <td>{a.action}</td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {JSON.stringify(a.detail)}
                  </td>
                </tr>
              ))}
              {!audit?.length && (
                <tr>
                  <td colSpan={3} className="text-muted-foreground">
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
