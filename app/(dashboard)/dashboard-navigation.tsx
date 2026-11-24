"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Compass, House, Inbox, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { clearAllProfileDrafts } from "@/lib/profile-draft";
import { Brand } from "@/components/brand";
import { HomeLogoLink } from "@/components/home-logo-link";
import { ClockStrip } from "@/components/nairobi-clock";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./workspace-frame.module.css";

const NAV = [
  { href: "/discover", label: "Discover Mentors", icon: Compass },
  { href: "/profile", label: "Your profile", icon: UserRound },
  { href: "/requests", label: "Requests & connections", icon: Inbox },
];

// The workspace header: the window seat sky with the Nairobi clock, logo and
// account actions, then an opaque strip of section tabs that stays in view.
// On phones the sections and account actions sit in a menu under the logo.
export function DashboardNavigation({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const items = role === "admin" || role === "moderator"
    ? [...NAV, { href: "/admin", label: "Administration", icon: ShieldCheck }]
    : NAV;

  const closeMenu = () => setOpen(false);
  const current = (href: string) => (pathname.startsWith(href) ? "page" : undefined);

  const member = (
    <div className={styles.member}>
      <span className={styles.initial} aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0">
        <p className={styles.memberName}>{name}</p>
        <p className={styles.memberRole}>{role}</p>
      </div>
    </div>
  );

  const account = (
    <>
      {member}
      <Link href="/" onClick={closeMenu} className={styles.control}>
        <House aria-hidden="true" />Public homepage
      </Link>
      <ThemeToggle className={styles.theme} />
      <form
        action={signOut}
        onSubmit={() => {
          if (typeof window !== "undefined") {
            clearAllProfileDrafts(window.sessionStorage);
          }
        }}
      >
        <button type="submit" className={styles.control}><LogOut aria-hidden="true" />Sign out</button>
      </form>
    </>
  );

  return (
    <>
      <header
        className={styles.frame}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
            toggle.current?.focus();
          }
        }}
      >
        <ClockStrip className={styles.clock} />
        <div className={styles.bar}>
          <div className={styles.brand}>
            <HomeLogoLink className={styles.logo} onNavigate={closeMenu}>
              <Brand imageClassName="h-10 sm:h-11" />
            </HomeLogoLink>
            <p className={styles.tagline}>Your workspace</p>
          </div>
          <div className={styles.account}>{account}</div>
          <button
            ref={toggle}
            type="button"
            className={`${styles.menu} ${styles.control}`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            {open ? "Close navigation" : "Open navigation"}
          </button>
        </div>
        <div id={panelId} className={styles.panel} hidden={!open}>
          <nav aria-label="Workspace" className={styles.panelLinks}>
            {items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={closeMenu} aria-current={current(href)} className={styles.panelLink}>
                <Icon aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
          <div className={styles.panelAccount}>{account}</div>
        </div>
      </header>
      <nav aria-label="Workspace" className={styles.tabs}>
        <div className={styles.tabList}>
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={current(href)} className={styles.tab}>
              <Icon aria-hidden="true" />{label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
