"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plane } from "lucide-react";
import styles from "./login-sky.module.css";

export function WindowMark() {
  return <div className={styles.windowMark} aria-hidden="true"><div className={styles.windowView}><div className={styles.cloudStrip}>{[0, 1, 2, 3].map(tile => <span key={tile} />)}</div><div className={styles.shade} /></div></div>;
}

export interface Arrival {
  kind: "signed-in" | "registered" | "confirmation";
  destination?: string;
  onContinue?: () => void;
}
export interface AuthJourneyHandle { play: (arrival: Arrival) => Promise<void>; reset: () => void; }

export function LoginJourney({ children, previewEnabled = false, ref, surface = "login" }: { children: ReactNode; previewEnabled?: boolean; ref?: Ref<AuthJourneyHandle>; surface?: "login" | "signup" }) {
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const pass = useRef<HTMLElement>(null);
  const motion = useRef<Animation[]>([]);
  const overlay = useRef<HTMLElement | null>(null);
  const scrollTimer = useRef<number | undefined>(undefined);
  const prefetchTimer = useRef<number | undefined>(undefined);
  const running = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const returnButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    mounted.current = true;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => motion.current.forEach(animation => animation.finish());
    const preferenceChanged = () => { if (reduced.matches) finish(); };
    window.addEventListener("resize", finish);
    reduced.addEventListener("change", preferenceChanged);
    return () => {
      mounted.current = false;
      window.removeEventListener("resize", finish);
      reduced.removeEventListener("change", preferenceChanged);
      window.clearTimeout(scrollTimer.current);
      window.clearTimeout(prefetchTimer.current);
      motion.current.forEach(animation => animation.cancel());
      overlay.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!showPass || busy || !pass.current) return;
    // Only scroll when the pass is not already fully on screen.
    const bounds = pass.current.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > innerHeight) {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      pass.current.scrollIntoView({ block: "center", behavior: reduced ? "instant" : "smooth" });
    }
    returnButton.current?.focus({ preventScroll: true });
  }, [showPass, busy]);

  async function previewJourney() {
    if (running.current || !card.current || !pass.current || !root.current) return;
    running.current = true;
    setBusy(true);
    const login = card.current;
    const ticket = pass.current;
    const animate = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(frames, { fill: "both", ...options });
      motion.current.push(animation);
      return animation;
    };
    // Expo out for arrivals, a symmetrical curve for the window opening.
    const settle = "cubic-bezier(.16,1,.3,1)";
    const open = "cubic-bezier(.76,0,.24,1)";
    login.inert = true;
    try {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // A short crossfade only: no movement, no zoom.
        ticket.hidden = false;
        animate(login, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
        animate(ticket, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 80 });
      } else {
        // The window opens until its sky fills the screen. The sky is drawn at
        // full size and revealed by a clip, so it stays sharp while it grows.
        const mark = login.querySelector<HTMLElement>(`.${styles.windowMark}`)!;
        const view = mark.querySelector<HTMLElement>(`.${styles.windowView}`)!;
        // On a long form the window can be scrolled out of sight: open from the
        // middle of the screen instead, so the sky never sweeps in from an edge.
        let frameBounds = mark.getBoundingClientRect();
        let viewBounds = view.getBoundingClientRect();
        if (frameBounds.top < 0 || frameBounds.bottom > innerHeight) {
          const dx = (innerWidth - frameBounds.width) / 2 - frameBounds.left;
          const dy = (innerHeight - frameBounds.height) / 2 - frameBounds.top;
          const shift = (bounds: DOMRect) => new DOMRect(bounds.left + dx, bounds.top + dy, bounds.width, bounds.height);
          frameBounds = shift(frameBounds);
          viewBounds = shift(viewBounds);
        }
        const clip = (bounds: DOMRect, radius: string) =>
          `inset(${bounds.top}px ${innerWidth - bounds.right}px ${innerHeight - bounds.bottom}px ${bounds.left}px round ${radius})`;
        const viewport = document.createElement("div");
        viewport.className = styles.flightViewport;
        viewport.setAttribute("aria-hidden", "true");
        const frame = document.createElement("div");
        frame.className = styles.flightFrame;
        const sky = document.createElement("div");
        sky.className = styles.flightSky;
        const clouds = document.createElement("div");
        clouds.className = styles.flightClouds;
        clouds.style.transformOrigin = `${viewBounds.left + viewBounds.width / 2}px ${viewBounds.top + viewBounds.height / 2}px`;
        sky.append(clouds);
        viewport.append(frame, sky);
        root.current.append(viewport);
        overlay.current = viewport;

        animate(login, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.97)" }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" });
        animate(frame, [{ clipPath: clip(frameBounds, getComputedStyle(mark).borderRadius) }, { clipPath: "inset(-8px round 0px)" }], { duration: 760, easing: open });
        animate(sky, [{ clipPath: clip(viewBounds, getComputedStyle(view).borderRadius) }, { clipPath: "inset(0px round 0px)" }], { duration: 760, easing: open });
        animate(clouds, [{ transform: "scale(1.7) translateX(0)" }, { transform: "scale(1) translateX(-2%)" }], { duration: 1100, easing: settle });
        // The pass rises while the window is still opening, so the two read as one move.
        animate(viewport, [{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: 560, easing: "ease-out" });
        ticket.hidden = false;
        // While the sky still covers the page, settle the layout and bring the pass on screen.
        scrollTimer.current = window.setTimeout(() => {
          // The card has been invisible since 380 ms; removing it now lets the page
          // settle to its final height out of sight, so the pass does not move later.
          login.hidden = true;
          // The pass still holds its starting offset (28px down) here, so work out where it will rest.
          const box = ticket.getBoundingClientRect();
          const centre = box.top + box.height / 2 - 28;
          const half = ticket.offsetHeight / 2;
          if (centre - half < 0 || centre + half > innerHeight) window.scrollBy({ top: centre - innerHeight / 2, behavior: "instant" });
        }, 480);
        animate(ticket, [{ opacity: 0, transform: "translateY(28px) scale(.96)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 760, delay: 520, easing: settle });
        const stub = ticket.querySelector(`.${styles.ticketStub}`);
        if (stub) animate(stub, [{ transform: "translateX(14px) rotate(1.5deg)" }, { transform: "translateX(0) rotate(0)" }], { duration: 720, delay: 640, easing: settle });
        const plane = ticket.querySelector(`.${styles.route} svg`);
        if (plane) animate(plane, [{ opacity: 0, transform: "translateX(-28px) rotate(45deg)" }, { opacity: 1, transform: "translateX(0) rotate(45deg)" }], { duration: 640, delay: 820, easing: settle });
        ticket.querySelectorAll("[data-flight-detail]").forEach((detail, index) => animate(detail, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 460, delay: 640 + index * 40, easing: settle }));
      }
      await Promise.all(motion.current.map(animation => animation.finished));
      if (mounted.current) {
        setShowPass(true);
        login.hidden = true;
        returnButton.current?.focus({ preventScroll: true });
      }
    } catch {
      // A route change cancels animation promises and unmounts this local preview.
      if (mounted.current) { ticket.hidden = true; login.hidden = false; }
    } finally {
      window.clearTimeout(scrollTimer.current);
      motion.current.forEach(animation => animation.cancel());
      motion.current = [];
      overlay.current?.remove();
      overlay.current = null;
      login.inert = false;
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    reset: resetJourney,
    async play(nextArrival) {
      setArrival(nextArrival);
      // Fetch the destination once the opening is done, so continuing is instant
      // without competing with the animation for the main thread.
      const destination = nextArrival.destination;
      window.clearTimeout(prefetchTimer.current);
      if (destination) prefetchTimer.current = window.setTimeout(() => router.prefetch(destination), 800);
      // Commit ticket copy before measuring and animating the shared surface.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await previewJourney();
    },
  }));

  function resetJourney() {
    setShowPass(false);
    setLeaving(false);
    setArrival(null);
    if (card.current) card.current.hidden = false;
    if (pass.current) pass.current.hidden = true;
    card.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  }

  function continueJourney() {
    if (leaving) return;
    if (arrival?.onContinue) return arrival.onContinue();
    if (!arrival?.destination) return resetJourney();
    setLeaving(true);
    // Client navigation keeps the sky in place instead of reloading the page.
    router.push(arrival.destination);
    if (pass.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pass.current.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(-14px) scale(.98)" }], { duration: 320, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    }
  }

  return <div ref={root} className={`${styles.journey} ${surface === "signup" ? styles.signupJourney : ""}`} data-sky-login aria-busy={busy}>
    <div className={styles.sky} aria-hidden="true" />
    <div className={styles.stage}>
      <div ref={card} className={surface === "signup" ? styles.signupJourneySurface : styles.card} hidden={showPass}>{children}</div>
      <section ref={pass} className={styles.ticket} hidden={!showPass} aria-label={arrival ? "Your mentorship boarding pass" : "Mentorship boarding pass design preview"}>
        <div className={styles.ticketMain}>
          <div data-flight-detail className={styles.ticketHeading}><span>AlumniKonneQt</span><span>{arrival ? arrival.kind === "confirmation" ? "Email confirmation needed" : arrival.kind === "registered" ? "Account created" : "Signed in" : "Design preview"}</span></div>
          <div data-flight-detail className={styles.route}><div><span>{arrival?.kind === "confirmation" ? "Account details" : "Your profile"}</span><strong>YOU</strong></div><Plane aria-hidden="true" /><div><span>{arrival?.kind === "confirmation" ? "Confirm your email" : "Your next connection"}</span><strong>{arrival?.kind === "confirmation" ? "MAIL" : "NEXT"}</strong></div></div>
          <div data-flight-detail className={styles.ticketInfo}><div><span>Start with</span><p>Your skills &amp; goals</p></div><div><span>Explore</span><p>Recommended mentors</p></div></div>
          <p data-flight-detail className={styles.ticketNote}>{arrival?.kind === "confirmation" ? "Check your email to complete registration. Your account is not confirmed yet." : "A new connection starts with what you know and where you want to go."}</p>
          <div data-flight-detail className={styles.ticketActions}><p>{arrival ? arrival.kind === "confirmation" ? "Follow the confirmation instructions before entering your workspace." : "Your account is ready. Continue when you are." : surface === "signup" ? "Preview only. No account has been created." : "Preview only. Sign in to enter your workspace."}</p><button ref={returnButton} type="button" className={arrival?.destination ? styles.continueButton : undefined} onClick={continueJourney} disabled={busy} aria-disabled={leaving || undefined}>{arrival ? arrival.kind === "confirmation" ? "View email instructions" : arrival.destination?.startsWith("/profile") ? "Continue to your profile" : "Open workspace" : surface === "signup" ? "Back to signup" : "Back to sign in"} <ArrowRight size={16} aria-hidden="true" /></button></div>
        </div>
        <div className={styles.ticketStub}><div data-flight-detail><span>Next stop</span><strong>{arrival?.kind === "confirmation" ? "Email" : arrival?.destination?.startsWith("/profile") ? "Profile" : "Discover"}</strong></div><div data-flight-detail className={styles.barcode} aria-hidden="true" /><span data-flight-detail>Mentorship journey</span></div>
      </section>
    </div>
    {previewEnabled && !showPass && !arrival && <button type="button" className={styles.previewButton} onClick={previewJourney} disabled={busy}>{busy ? "Flying into the preview…" : "Preview the boarding pass"}<ArrowRight size={14} aria-hidden="true" /><span>Local design preview</span></button>}
    <p className="sr-only" role="status">{leaving ? arrival?.destination?.startsWith("/profile") ? "Opening your profile." : "Opening your workspace." : showPass ? arrival ? arrival.kind === "confirmation" ? "Registration needs email confirmation. View your email instructions." : "Authentication completed. Your boarding pass is ready." : "Mentorship boarding pass preview. No sign-in was submitted." : busy ? "Playing the window flight preview" : ""}</p>
  </div>;
}
