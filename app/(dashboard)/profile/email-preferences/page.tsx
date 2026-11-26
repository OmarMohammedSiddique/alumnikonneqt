import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveEmailPreferences, unsubscribeActivityEmails } from "./actions";

export const metadata = { title: "Email preferences - AlumniKonneQt" };

export default async function EmailPreferencesPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const [{ data, error }, params] = await Promise.all([
    supabase.from("email_preferences").select("requests, connections, matches, reminders").eq("user_id", user.id).maybeSingle(),
    searchParams,
  ]);
  return (
    <div className="grid gap-6">
      <PageHeading title="Email preferences">Choose which activity emails you receive. Uncheck a category to unsubscribe.</PageHeading>
      {params.saved && !error && <StatusMessage tone="success">Your email preferences have been saved.</StatusMessage>}
      {(error || params.error) && <StatusMessage tone="error">We couldn’t load or save your preferences. Please try again.</StatusMessage>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start xl:gap-10">
        <Card>
          <CardHeader>
            <CardTitle><h2>Optional activity emails</h2></CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveEmailPreferences}>
              <fieldset disabled={Boolean(error)} className="space-y-5">
                <legend className="sr-only">Optional activity emails</legend>
                {([
                  ["requests", "Mentorship requests", "New requests and declined-request updates."],
                  ["connections", "Successful connections", "Confirmation when a mentorship request is accepted."],
                  ["matches", "Mentor recommendations", "Recommendations after your match profile changes, at most once per day."],
                  ["reminders", "Pending-request reminders (Mentors)", "Opt in to one reminder after three days for a new request received while enabled. At most one reminder per week; requests older than seven days receive no reminders. Turn this off to cancel queued reminders."],
                ] as const).map(([key, label, description]) => (
                  <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input type="checkbox" name={key} defaultChecked={data?.[key] ?? key !== "reminders"} className="mt-1 size-5 shrink-0 accent-primary" />
                    <span><span className="block font-medium">{label}</span><span className="text-sm text-muted-foreground">{description}</span></span>
                  </label>
                ))}
                <Button type="submit">Save email preferences</Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle><h2>Stop all activity email</h2></CardTitle>
              <CardDescription>Turn off every optional activity email in one step.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form action={unsubscribeActivityEmails}>
                <Button type="submit" variant="outline" disabled={Boolean(error)}>Unsubscribe from all activity email</Button>
              </form>
              <p className="text-sm text-muted-foreground">Confirmation, sign-in and password recovery emails are managed separately and remain available regardless of these settings.</p>
            </CardContent>
          </Card>
          <Link href="/profile" className="inline-flex min-h-11 items-center justify-self-start text-sm underline underline-offset-4">Back to your profile</Link>
        </div>
      </div>
    </div>
  );
}
