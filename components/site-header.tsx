import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { HomeLogoLink } from "@/components/home-logo-link";
import { NairobiClock } from "@/components/nairobi-clock";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import styles from "./site-header.module.css";

const SECTIONS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#community", label: "Community" },
  { href: "/#questions", label: "FAQs" },
];

// One navigation bar for every public page. It continues the bar shown over
// the cabin intro: logo and tagline, the Nairobi clock, then the sections.
export async function SiteHeader({
  sticky = false,
  flush = false,
  className = "",
}: {
  sticky?: boolean;
  /** Fill the parent instead of using the page gutter. */
  flush?: boolean;
  className?: string;
}) {
  // Cached per request, so pages that also read the user do not ask twice.
  const { user } = await getAuthenticatedUser();
  const member = Boolean(user);
  return (
    <header className={`${styles.header} ${sticky ? styles.sticky : ""} ${className}`}>
      <div className={`${styles.bar} ${flush ? styles.flush : ""}`}>
        <div className={styles.brand}>
          <HomeLogoLink className={styles.logo}>
            <Brand imageClassName="h-10 sm:h-11" />
          </HomeLogoLink>
          <span className={styles.tagline} aria-hidden="true">Alumni mentorship network</span>
        </div>
        <NairobiClock className={styles.clock} />
        <div className={styles.right}>
          <nav className={styles.sections} aria-label="Main navigation">
            {SECTIONS.map(section => <Link key={section.href} href={section.href}>{section.label}</Link>)}
          </nav>
          <div className={styles.actions}>
            <Link href={member ? "/profile" : "/login"} className={styles.signIn}>{member ? <span><span className={styles.more}>Your </span>profile</span> : "Sign in"}</Link>
            <Link href={member ? "/discover" : "/signup"} className={styles.join}>
              <span>{member ? <><span className={styles.more}>Open </span>workspace</> : <>Join<span className={styles.more}> the network</span></>}</span> <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
