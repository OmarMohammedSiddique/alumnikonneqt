import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";
import { PhotoForm } from "./photo-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Profile picture - AlumniKonneQt" };

export default async function ProfilePhotoPage({ searchParams }: { searchParams: Promise<{ retry?: string }> }) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/profile/photo");
  const photos = supabase.storage.from("profile-photos");
  const path = `${user.id}/avatar`;
  const [{ data }, { data: info }, { retry }] = await Promise.all([
    photos.createSignedUrl(path, 300),
    photos.info(path),
    searchParams,
  ]);
  // Storage can issue an identical signed URL for rapid same-path replacements.
  // Version the rendered src by the stored object, not the signing timestamp.
  const photoUrl = data?.signedUrl ? new URL(data.signedUrl) : null;
  if (info?.version) photoUrl?.searchParams.set("v", info.version);
  return <div className="grid gap-6">
    <PageHeading title="Your profile picture">Choose a picture to help other members recognise you. Photos are accessible to signed-in members.</PageHeading>
    {retry && <p role="status">Your account was created, but your picture could not be uploaded. Please choose it again below.</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start xl:gap-10">
      <Card>
        <CardHeader>
          <CardTitle><h2>Current picture</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl ? <img src={photoUrl.href} alt="Your current profile picture" className="aspect-square w-full max-w-60 rounded-2xl border object-cover" />
            : <p className="text-sm text-muted-foreground">You have not added a picture yet.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><h2>Choose a new picture</h2></CardTitle>
          <CardDescription>{photoUrl ? "Your new picture replaces the current one as soon as you save it." : "Your picture is added to your profile as soon as you save it."}</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoForm />
        </CardContent>
      </Card>
    </div>
    <Link href="/profile" className="inline-flex min-h-11 items-center justify-self-start text-primary underline">Back to your profile</Link>
  </div>;
}
