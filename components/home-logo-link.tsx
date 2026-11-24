"use client";

// The logo always reloads the home page from the top, so the cabin intro plays
// again from any view. A client-side route change would keep the page state and
// skip the intro.
export function HomeLogoLink({
  className,
  children,
  onNavigate,
}: {
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Leave new-tab and new-window clicks to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();
    if (window.location.pathname === "/") {
      // Reloading restores the scroll position, so return to the top first.
      window.history.replaceState(null, "", "/");
      window.scrollTo({ top: 0, behavior: "instant" });
      window.location.reload();
    } else {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load replays the intro
      window.location.assign("/");
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load is the point here
    <a href="/" aria-label="AlumniKonneQt home" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
