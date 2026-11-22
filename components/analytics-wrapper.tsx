"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { filterAnalyticsEvent, useCookieConsent } from "@/lib/cookie-consent";

// Both Vercel scripts load only after the visitor accepts analytics, and each
// event is checked against the live consent choice before it is sent.
export function AnalyticsWrapper() {
  const { preferences, hasDecided } = useCookieConsent();
  if (!hasDecided || !preferences.analytics) return null;
  return (
    <>
      <Analytics beforeSend={filterAnalyticsEvent} />
      <SpeedInsights beforeSend={filterAnalyticsEvent} />
    </>
  );
}
