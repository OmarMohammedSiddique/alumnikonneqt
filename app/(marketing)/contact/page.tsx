import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Send } from "lucide-react";
import mark from "@/app/icon.png";
import { Brand, PrototypeNotice } from "@/components/brand";
import { CookieSettingsTrigger } from "@/components/cookie-settings-trigger";
import { NairobiClock } from "@/components/nairobi-clock";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/site";
import { CopyAddress } from "./copy-address";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact and support - AlumniKonneQt",
  description:
    "Write to the AlumniKonneQt support desk about your account, the mentorship workspace, your data or the research behind this academic prototype.",
};

// Each lane opens the same inbox with a subject line, so messages arrive sorted.
const LANES = [
  {
    code: "01",
    title: "Account and sign-in",
    body: "Trouble signing in, confirming your email or changing your account details.",
    subject: "Account help",
  },
  {
    code: "02",
    title: "Privacy and your data",
    body: "Questions about what this prototype holds about you and how it is used.",
    subject: "Privacy and data",
  },
  {
    code: "03",
    title: "Feedback and research",
    body: "Something broken, an idea, or a question about the study behind the project.",
    subject: "Feedback",
  },
];

// Decorative stripe widths for the stub. Fixed, so server and client render the same.
const STRIPES = [3, 1, 2, 1, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 3, 1, 2, 1, 1, 3, 2, 1, 4, 1, 1, 2, 3, 1, 2, 1, 4, 1, 1, 3, 1, 2];

export default function ContactPage() {
  const [local, domain] = SUPPORT_EMAIL.split("@");

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">Skip to content</a>

      <header className={styles.header}>
        <Link href="/" aria-label="AlumniKonneQt home" className={styles.home}>
          <Brand tone="dark" imageClassName="h-9 sm:h-10" />
        </Link>
        <NairobiClock className={styles.clock} />
        <nav aria-label="Main navigation" className={styles.nav}>
          <Link href="/#how-it-works" className={styles.navOptional}>How it works</Link>
          <Link href="/about-developer" className={styles.navOptional}>About</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/contact" aria-current="page">Contact</Link>
        </nav>
      </header>

      <main id="main" className={styles.main}>
        <div className={styles.tag}>
          <span className={styles.tagMark} aria-hidden="true"><Send size={22} strokeWidth={1.75} /></span>
          <div>
            <p>Check-in</p>
            <h1>Contact and support, boarding any time</h1>
          </div>
        </div>

        <article className={styles.ticketShadow} aria-label="Support desk contact details">
          <div className={styles.ticket}>
            <div className={styles.pass}>
              <p className={styles.issuer}>Issued by: AlumniKonneQt, an independent academic prototype</p>
              <div className={styles.route} aria-hidden="true"><span><Send size={26} strokeWidth={1.5} /></span></div>

              <dl className={styles.fields}>
                <div><dt>Passenger</dt><dd>You</dd></div>
                <div className={styles.wide}><dt>Class</dt><dd>Account help / Privacy / Feedback</dd></div>
                <div><dt>From</dt><dd>A question</dd></div>
                <div className={styles.wide}><dt>To</dt><dd>A reply from a person</dd></div>
                <div><dt>Ref</dt><dd>AKQ 254</dd></div>
                <div><dt>Gate</dt><dd>{local}@</dd></div>
                <div><dt>Boarding</dt><dd>Any time</dd></div>
              </dl>

              <div className={styles.addressRow}>
                <a className={styles.address} href={supportMailto()}>
                  <span className="sr-only">Email </span><span id="support-address">{local}<wbr />@{domain}</span>
                </a>
                <CopyAddress address={SUPPORT_EMAIL} targetId="support-address" className={styles.copy} />
              </div>
            </div>

            <aside className={styles.stub} aria-label="Project details">
              <span className={styles.seal}><Image src={mark} alt="" width={96} height={96} /></span>
              <dl className={styles.stubFields}>
                <div><dt>Base</dt><dd>Nairobi / Kenya</dd></div>
                <div><dt>Project</dt><dd>A Strathmore University capstone</dd></div>
                <div>
                  <dt>Elsewhere</dt>
                  <dd>
                    <a href="https://omarsiddique.com" target="_blank" rel="noopener noreferrer">Developer <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a>
                    <a href="https://github.com/OmarMohammedSiddique/alumnikonneqt" target="_blank" rel="noopener noreferrer">Source <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a>
                  </dd>
                </div>
              </dl>
              <div className={styles.stripes} aria-hidden="true">
                {STRIPES.map((width, index) => <i key={index} style={{ width }} />)}
              </div>
            </aside>
          </div>
        </article>

        <section className={styles.lanes} aria-labelledby="lanes-heading">
          <h2 id="lanes-heading">What are you writing about?</h2>
          <ul>
            {LANES.map((lane) => (
              <li key={lane.code}>
                <a href={supportMailto(lane.subject)}>
                  <span className={styles.laneCode} aria-hidden="true">{lane.code}</span>
                  <strong>{lane.title}</strong>
                  <span>{lane.body}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            A person reads every message. This is a student-run prototype, so a reply can take a few days.
            To report another member, use the report option on their profile card so the details reach an administrator.
            For a suspected security problem, please follow the{" "}
            <a href="https://github.com/OmarMohammedSiddique/alumnikonneqt/security/policy" target="_blank" rel="noopener noreferrer">security policy<span className="sr-only"> (opens in a new tab)</span></a>{" "}
            instead of sending details by email.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.runway} aria-hidden="true"><span><Send size={24} strokeWidth={1.5} /></span></div>
        <nav aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/about-developer">About Developer</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <CookieSettingsTrigger className={styles.footerButton} />
        </nav>
        <PrototypeNotice className={styles.notice} />
      </footer>
    </div>
  );
}
