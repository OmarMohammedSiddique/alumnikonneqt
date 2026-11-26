# Launch review before v1.3.0, 25 November 2026

Scope: `main` at commit `52cd63c`, which is also the release the live site reports (`sentry-release=52cd63c...` on https://alumnikonneqt.com). Both parts were run: 32 security checks and 13 privacy, legal and accessibility checks. This is the pre-release review required before tagging v1.3.0.

The previous full review is [security-review-2026-11-22.md](security-review-2026-11-22.md) (issue 138). This review concentrates on what merged since then and re-checks that the earlier fixes still hold on the live site:

| Pull request | What it changed | Relevance to this review |
| --- | --- | --- |
| 149 | Fixes from the 22 November review | Re-checked: headers, migration, RLS tests |
| 150 | Window seat sign-in journey, arrival screen, interface refresh | New auth redirects, new routes, new media |
| 152 | Bounded local load test of `/api/match` | Script only; loopback guard checked |
| 153 | Materials for the planned usability study | Documentation only; nothing collected yet |
| 154 | Landing page and shared navigation bar | Public copy and links |
| 156 | README screenshot and walkthrough GIF | Own captures of the site; no third-party media |
| 157 | All rights reserved, `"license": "UNLICENSED"` | Licensing (P10) |
| 159 | Vercel Functions in Dublin (`dub1`) | Hosting region, privacy text (P1, P13) |
| 161 | Human review analysis for synth-v3 | Python analysis only, no runtime change |
| 162 | Automated axe checks in CI | Accessibility (P11, P12), CI (check 28) |
| 163 | ESLint ignores agent worktrees | Tooling only |

Pending, not reviewed here because they are not on `main`: pull request 164 (keep demo accounts and real members apart), 165 (low-severity findings, issue 147) and 167 (audit rows for administrator deletions, issue 142). Pull request 135 (contact page) is also still open.

Method: read-only. No sign-in to the live site, no credentials entered, no change to Supabase, Vercel or GitHub settings. The database suites ran on the Azure development stack, never on the Mac. This is not legal advice.

## Verdict

Ready to tag v1.3.0 as a prototype release. Nothing merged since 22 November introduces a security flaw, and every fix from pull request 149 still holds on the live site. No critical or high security finding.

The two high privacy gaps from 22 November are still open and are carried forward, not new: the published privacy page is the old prototype text (P1, issue 140) and there is no account deletion or export (P6, issue 139). They do not block a version tag, but the release notes must not describe the site as ready for real alumni at scale until both close. Two medium items also remain from 22 November: leaked password protection is off (check 6, issue 138) and rate limits are per instance (check 24, issue 141).

New in this review: one low finding in code, fixed on this branch (unsupported claims on the developer page, P9), one low gap in repository protection, opened as issue 168 (check 28), and a note for the privacy draft about the new hosting region (P1, comment on issue 140).

## Summary

Status is what this audit found. "Carried" means the finding is unchanged from 22 November and its issue is still open.

### Part 1: security

| # | Check | Status | Severity | Fixed |
| --- | --- | --- | --- | --- |
| 1 | Committed secrets and `.env` files | Not found | None | Not needed |
| 2 | Secrets in client-side code | Not found | None | Not needed (`server-only` guards in pull request 165) |
| 3 | Publicly served files | Not found | Low | Carried: `robots.txt` and `security.txt` in pull request 165 |
| 4 | Debug mode and verbose errors | Not found | None | Not needed |
| 5 | Password storage | Not found | None | Not needed |
| 6 | Password strength and breach checks | Found | Medium | Carried: dashboard setting, issue 138 |
| 7 | Email verification | Not found, setting to confirm | Low | Carried: secure email change, issue 138 |
| 8 | Brute force and login abuse | Not found, settings to confirm | Low | Carried: issue 138 |
| 9 | Password reset and magic links | Not found, setting to confirm | Low | Carried: redirect allowlist, issue 138 |
| 10 | Session token storage and lifetime | Not found | Low | Carried: demo cookie in pull request 165 |
| 11 | CSRF | Not found | Low | Carried: Origin check in pull request 165 |
| 12 | Row-level security and storage policies | Not found | None | Fixes from 149 hold |
| 13 | Server-side permission checks | Not found | None | Fixes from 149 hold |
| 14 | Insecure direct object references | Not found | None | Not needed |
| 15 | Mass assignment | Not found | None | Fixes from 149 hold |
| 16 | Least privilege and environments | Found | Medium | Accepted on 23 November, unchanged |
| 17 | Server-side input validation | Not found | None | Not needed |
| 18 | Injection | Not found | None | Not needed |
| 19 | Cross-site scripting | Not found | None | Not needed |
| 20 | SSRF and open redirects | Not found | None | New redirects checked |
| 21 | File uploads | Not found | Low | Carried: photo removal, issue 139 |
| 22 | Security headers and HTTPS | Not found | Low | Headers hold; full policy enforcement in issue 143 |
| 23 | CORS | Not found | None | Not needed |
| 24 | Rate limiting and bot protection | Found | Medium | Carried: issue 141 |
| 25 | Webhook signature verification | Not found | Low | Carried: replay record in pull request 165 |
| 26 | Cost controls and AI endpoints | Not applicable | None | No paid AI API; spend management in issue 141 |
| 27 | Vulnerable dependencies | Not found | None | Not needed |
| 28 | Unused packages, lockfile, repo protections | Found | Low | No: issue 168 |
| 29 | Sensitive data in logs and analytics | Not found | None | Not needed |
| 30 | Audit logging | Found | Low | Carried: pull request 167, issue 142 |
| 31 | Backups and recovery | Needs my decision | Low | Carried: issue 145 |
| 32 | Secret inventory | Not found | None | `docs/guides/secrets.md` still accurate |

### Part 2: privacy, legal and accessibility

| # | Check | Status | Severity | Fixed |
| --- | --- | --- | --- | --- |
| P1 | Privacy policy | Found | High | Carried: issue 140; hosting region note added there |
| P2 | Terms and conditions | Found | Medium | Carried: issue 140 |
| P3 | Cookies and consent | Not found | Low | Cookie list on the live page still incomplete (issue 140) |
| P4 | Forms, consent and data minimisation | Found | Medium | Carried: issue 140 |
| P5 | Analytics and third-party embeds | Not found | None | Both Vercel products now active and behind consent |
| P6 | Data export and deletion | Found | High | Carried: issue 139 |
| P7 | Refund and cancellation policy | Not applicable | None | Nothing is sold |
| P8 | Business details | Found | Low | Carried: contact page in pull request 135 |
| P9 | Honest content | Found | Low | Yes, on this branch |
| P10 | Image, font and code licensing | Found | Medium | Partly: all rights reserved stated (157); image sources in issue 144 |
| P11 | Accessibility: content | Found | Medium | Partly: axe in CI (162); light theme borders in issue 166 |
| P12 | Accessibility: interaction | Not found | Low | New journeys checked; wider coverage in issue 146 |
| P13 | Applicable laws and other legal risks | Needs my decision | Not rated | Carried: issue 148; Dublin move noted |

## Part 1: findings

### 1. Committed secrets and `.env` files

- Status: Not found.
- Evidence: `gitleaks git --log-opts="b1d2cf5..HEAD"` scanned the 11 commits since the last full scan and found no leaks. `git ls-files` shows `.env.example` as the only tracked env file. GitHub reports 0 open secret scanning alerts.

### 2. Secrets in client-side code

- Status: Not found.
- Evidence: a production build of `52cd63c` was searched under `.next/static` for `sb_secret_`, `service_role`, Resend, webhook, worker, Turnstile secret and Sentry auth token patterns: no match. No source maps are emitted (0 `*.map` files). The new arrival and login journey components hold no keys.

### 3. Publicly served files

- Status: Not found. Severity: low.
- Evidence: on the live site `/.env`, `/.env.local`, `/.git/config`, `/package.json`, `/.DS_Store`, `/demo`, `/sitemap.xml`, the new design previews `/preview/cabin-intro` and `/preview/mentor-passes`, and the committed `brag-output/` and `previews/` folders all return 404. Requests for `*.js.map` return 403. The two preview pages call `notFound()` in production; the build marks them static, and the live check confirms they 404.
- Open: still no `robots.txt` or `security.txt` (pull request 165, issue 147).

### 4. Debug mode and verbose errors

- Status: Not found.
- Evidence: the new Google callback still returns a fixed error code (`oauth_error=exchange_failed`) and never the provider's description. Unauthenticated API calls return `{"error":"Not authenticated"}` with no stack or path.
- Note: the `server-timing` header on `/login` carries Sentry tracing baggage (environment, release commit, public DSN key, organisation ID). These values are public by design and the repository is public, so this is informational only.

### 5. Password storage

- Status: Not found.
- Evidence: pull request 150 split `signUp` and `signIn` into helpers that return a destination, but passwords still go only to `supabase.auth.signUp` and `signInWithPassword` and are not logged or stored.

### 6. Password strength and breach checks

- Status: Found. Severity: medium. Carried.
- Evidence: the Supabase security advisor, run on 25 November 2026, still reports "Leaked Password Protection Disabled". The hosted minimum length cannot be read through the API.
- Fix: needs the Supabase dashboard (issue 138).

### 7. Email verification

- Status: Not found, setting to confirm. Severity: low. Carried.
- Evidence: the new `/arrival` page calls `getAuthenticatedUser()` and sends anyone without a session to `/login` (confirmed live: 307 to `/login`). Sign-up with email confirmation still ends on the confirmation instructions, not in the workspace.
- Open: "Secure email change" is still unconfirmed in the dashboard.

### 8. Brute force and login abuse

- Status: Not found, settings to confirm. Severity: low. Carried.
- Evidence: `signInWithArrival` and `signUpWithArrival` reuse the same helpers, which pass the Turnstile token to Supabase and return the same "Invalid email or password." message whether or not the account exists.
- Open: hosted rate limit values and Turnstile enforcement in the dashboard.

### 9. Password reset and magic links

- Status: Not found, setting to confirm. Severity: low. Carried.
- Evidence: the email sign-in code (`app/(auth)/login/code/actions.ts`) and the sign-up confirmation code (`app/(auth)/account-email-actions.ts`) now redirect to `/arrival?next=...`, and the value is passed through `getSafeSignInRedirect` both before it is placed in the URL and again when the arrival page reads it. Password recovery is unchanged: it updates the password, signs out everywhere and ends on `/login?password_reset=1`.
- Open: the hosted redirect URL allowlist.

### 10. Session token storage and lifetime

- Status: Not found. Severity: low. Carried.
- Evidence: in the browser on the live site, `document.cookie` is empty on `/` and `/login` and local storage holds only the consent choice and theme. No token is written to storage by the new journey code.
- Open: the presenter cookie on sign-out (pull request 165).

### 11. CSRF

- Status: Not found. Severity: low. Carried.
- Evidence: the new arrival actions are Server Actions, which check the origin. No new route handler was added.
- Open: explicit Origin checks on the four cookie-authenticated POST route handlers (pull request 165).

### 12. Row-level security and storage policies

- Status: Not found. The fixes from pull request 149 hold.
- Evidence:
  - No migration was added after `20261123090000_launch_review_hardening.sql`. The hosted project lists 16 migrations, ending with `launch_review_hardening`; the repository has 16.
  - With the public anon key against production (read-only GET requests): `profiles`, `mentorship_requests`, `connections`, `reports`, `blocks`, `audit_logs`, `email_outbox`, `email_suppressions`, `connection_contacts` and `email_preferences` all return permission denied (42501). `current_user_role` and `get_my_blocks` return permission denied. Listing the `profile-photos` bucket returns an empty list.
  - The six database suites ran on the Azure development stack (at migration `20261123090000`) through `ssh alumnikonneqt-azure` and `docker exec` on the VM: `rls_tests` ("ALL RLS TESTS PASSED"), `email_notifications`, `request_reminders`, `cold_start_embeddings`, `connection_journey` ("ALL CONNECTION JOURNEY TESTS PASSED") and `google_signup_policy`, all exit 0. Each suite runs inside a transaction that is rolled back.
  - CI "Database permission tests" passed on `52cd63c`.
  - The Supabase security advisor returns the same three items as on 22 November: two tables with RLS and no policy (intended, service role only), seven SECURITY DEFINER functions callable by signed-in users (intended, each checks the caller), and leaked password protection (check 6).

### 13. Server-side permission checks

- Status: Not found.
- Evidence: `/admin` and `/discover` still redirect to `/login` without a session (live, 307). The admin page changes in pull request 150 are labels and layout only.

### 14. Insecure direct object references

- Status: Not found. No new route reads a resource by ID.

### 15. Mass assignment

- Status: Not found. TEST 21c in `rls_tests.sql` passed on the development stack.

### 16. Least privilege and environments

- Status: Found. Severity: medium. Accepted on 23 November 2026, unchanged.
- Evidence: the Vercel project still has deployment protection for every deployment except the custom domains (`ssoProtection: all_except_custom_domains`), which is the condition the acceptance rested on.

### 17. Server-side input validation

- Status: Not found. The new actions accept no new fields; `next` is the only new input and is sanitised.

### 18. Injection

- Status: Not found.
- Evidence: the new scripts (`load-test-match.mjs`, `run-accessibility.mjs`, `verify-accessibility.mjs`, `capture-readme-preview.mjs`) use `execFileSync` and `spawn` with argument arrays and no user input. No new SQL or PostgREST filter strings.

### 19. Cross-site scripting

- Status: Not found.
- Evidence: the only `dangerouslySetInnerHTML` is still the constant theme script in `app/layout.tsx`. The mentor fan and boarding pass components render profile fields as React text and add no links from profile data.

### 20. SSRF and open redirects

- Status: Not found.
- Locations checked: `app/auth/callback/route.ts`, `app/(auth)/arrival/page.tsx`, `app/(auth)/actions.ts`, `app/(auth)/login/code/actions.ts`, `app/(auth)/account-email-actions.ts`, and the client `window.location.assign(arrival.destination)` in `app/(auth)/login/login-journey.tsx`.
- Evidence: every destination comes from `getSafeSignInRedirect`, which accepts only same-origin relative paths; its cases are in `lib/auth-redirect.test.mjs`, which passes. The client only receives a destination that the server has already cleaned. The Google callback ignores any `next` in its query string and reads only the httpOnly `alumnikonneqt-google-next` cookie, which is cleaned when it is set (`app/(auth)/actions.ts`) and again when it is read. Live: `/auth/callback?next=//evil.example/x` lands on `/login?oauth_error=exchange_failed&next=%2Fdiscover`, which shows the query value is not used.

### 21. File uploads

- Status: Not found. Severity: low. Carried: no photo removal (issue 139). No upload code changed.

### 22. Security headers and HTTPS

- Status: Not found. Severity: low. The fixes from pull request 149 hold.
- Evidence: `curl -I` on `https://alumnikonneqt.com/` and `/login` on 25 November 2026 returns `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, the full report-only policy, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and the Permissions-Policy, with no `x-powered-by`. `http://` and `www` both answer 308 to `https://alumnikonneqt.com/`.
- In the browser, `/` and `/login` loaded with no console message, so no report-only violation from the new window seat interface. The Vercel scripts load from same-origin paths, so `'self'` covers them.
- Open: enforce the full policy (issue 143).

### 23. CORS

- Status: Not found. No route sets `Access-Control-Allow-Origin`; a POST from a foreign Origin gets no CORS header.

### 24. Rate limiting and bot protection

- Status: Found. Severity: medium. Carried (issue 141). No change since 22 November.

### 25. Webhook signature verification

- Status: Not found. Severity: low. Unsigned POST to `/api/webhooks/resend` returns 400. Replay record carried in pull request 165.

### 26. Cost controls and AI endpoints

- Status: Not applicable. No paid AI API. Vercel spend management still unconfirmed (issue 141).

### 27. Vulnerable dependencies

- Status: Not found.
- Evidence: `npm audit` reports 0 vulnerabilities; Dependabot shows 0 open alerts; code scanning shows 0 open alerts. Installed: Next.js 16.4.5 (16.4.6 is the latest patch), React 19.2.4, `@supabase/ssr` 0.12.0, `@supabase/supabase-js` 2.110.0, `@sentry/nextjs` 11.14.0. The only `package.json` changes since 22 November are the licence field and two accessibility scripts.

### 28. Unused packages, lockfile and repository protections

- Status: Found. Severity: low.
- Evidence: `knip` reports no unused dependency. The lockfile is committed and every CI job installs with `npm ci`. The CI workflow keeps `permissions: contents: read` and the new accessibility job uses no secrets. Squash merge only, branch deletion on merge, push protection and Dependabot security updates are still on.
- Finding: the "Protect main" ruleset requires only Quality checks, Database permission tests and ML regression tests. The Cold-start browser journey and the new Accessibility checks run on every pull request but are not required, so a pull request can merge while either is red.
- Fix: a GitHub setting, so not changed here. Issue 168.

### 29. Sensitive data in logs, errors and analytics

- Status: Not found. The new scripts write only counts, timings and fictional test addresses; the load test samples file holds no IDs or addresses.

### 30. Audit logging

- Status: Found. Severity: low. Carried: administrator deletions are not recorded (pull request 167, issue 142).

### 31. Backups and recovery

- Status: Needs my decision. Severity: low. Carried (issue 145).

### 32. Secret inventory

- Status: Not found. No new secret was added since 22 November; `docs/guides/secrets.md` still lists every one.

## Part 2: findings

### P1. Privacy policy

- Status: Found. Severity: high. Carried (issue 140).
- Evidence: the live `/privacy` page is the prototype text reviewed on 22 November, restyled by pull request 150 but not rewritten. Its analytics paragraph is accurate: Vercel Web Analytics and Speed Insights set no cookie and load only after the analytics choice (`components/analytics-wrapper.tsx` renders neither until consent).
- New since 22 November: pull request 159 moved the Vercel Functions from Washington, D.C. (`iad1`, recorded in issue 158) to Dublin (`dub1`). Live responses now show `x-vercel-id: cpt1::dub1::...`: the page is served from the nearest edge location (Cape Town for this request) and the server code runs in Dublin, beside the database in `eu-west-1`. Neither the live page nor the draft in `docs/notes/2026-11-23-privacy-policy-and-terms-draft.md` names the hosting region. The draft's "Some of these companies process information outside Kenya" is still true. Proposed wording for the Vercel row is posted as a comment on issue 140 for Omar's approval; the legal text itself was not changed.

### P2. Terms and conditions

- Status: Found. Severity: medium. Carried (issue 140).

### P3. Cookies and consent

- Status: Not found. Severity: low.
- Evidence: `curl -D -` on `/`, `/login`, `/signup`, `/privacy`, `/about-developer` and `/forgot-password` shows no `Set-Cookie`. The arrival journey adds no cookie. The cookie list on the live page is still incomplete; the draft corrects it (issue 140).

### P4. Forms, consent and data minimisation

- Status: Found. Severity: medium. Carried (issue 140). The restyled sign-up form collects the same fields as before.

### P5. Analytics and third-party embeds

- Status: Not found.
- Evidence: the Web Analytics and Speed Insights endpoints on the live site both answer 200, so the Speed Insights decision from 22 November is done. On a fresh page load the only third-party resource is Cloudflare Turnstile on the sign-in form. Fonts and the new auth images are self-hosted.

### P6. Data export and deletion

- Status: Found. Severity: high. Carried (issue 139).

### P7. Refund and cancellation policy

- Not applicable. Nothing is sold.

### P8. Business details

- Status: Found. Severity: low. Carried: the contact page is still in pull request 135.

### P9. Honest content

- Status: Found. Severity: low.
- Location: `app/(marketing)/about-developer/page.tsx`, the evaluation card.
- Evidence: the card claimed "comprehensive empirical evaluation" and "strict compliance with academic research standards". The evaluation in `docs/eval-results.md` uses 24 synthetic queries and 40 synthetic Mentors, and the usability study is planned, not run. The test count was stated as "over 150"; `npm test` now runs 274.
- Fix: the card now says matching is compared with keyword and category baselines on synthetic profiles, that over 250 automated tests guard the code, and that a study with real participants is planned and has not yet been run. Its heading is now "Evaluation", and two American spellings on the page are now British.
- Verification: lint, type check, unit tests and build pass on this branch.
- Also checked: the landing page copy from pull requests 150 and 154 labels the example profile as illustrative, says shared skills do not guarantee suitability, and keeps the non-endorsement notice.

### P10. Image, font and code licensing

- Status: Found. Severity: medium. Partly fixed.
- Evidence: pull request 157 states all rights reserved in the README and sets `"license": "UNLICENSED"`, which closes the licence half of issue 144. `brag-output/README.md` credits its music (CC BY 4.0, credited in the film), sound effects (CC0), photograph (Unsplash licence) and the GSAP runtime. `previews/window-seat/README.md` records `clouds.png` as generated. The sources of `public/images/auth/clouds.webp` and `night-sky.webp` and the landing images are still not recorded (issue 144).

### P11. Accessibility: content

- Status: Found. Severity: medium. Partly fixed.
- Evidence: pull request 162 runs axe and a 3:1 control border check on the public, member, Mentor and administrator pages in both themes; the "Accessibility checks" job passed on `52cd63c`. `scripts/accessibility-known-issues.json` lists four known exceptions for control borders, all tracked in issue 166: `/profile`, `/discover` and `/requests` in the light theme, and `/admin` in both themes. The page declares `lang="en"`.

### P12. Accessibility: interaction

- Status: Not found. Severity: low.
- Checked by reading the code: the login journey makes the form `inert` while the animation plays, announces the result in a `role="status"` region, and skips movement under `prefers-reduced-motion`; the mentor fan, landing page and site header have reduced-motion rules. Keyboard behaviour on the live pages was not driven by hand in this review, because the member pages need sign-in; the CI axe run covers them. Wider coverage stays in issue 146.

### P13. Applicable laws and other legal risks

- Status: Needs my decision. Not rated. Carried (issue 148).
- New: with the functions in Dublin, the server code and the database now both run in the EU, and the United States leg noted on 22 November is no longer the function region (Vercel, Resend, Google and Cloudflare remain United States companies). Transfers outside Kenya still happen, so the question for a qualified person is unchanged.

## Release notes for the owner

- `package.json` still says `"version": "0.1.0"` while the tags are at v1.2.0. Consider bumping it to 1.3.0 in the release commit.
- The Supabase project is still named "AlumniConnect"; the rename to `alumnikonneqt-production` approved on 23 November has not been done (dashboard only).
- `AGENTS.md` lists the scripts that start a local Docker stack, but not `scripts/run-accessibility.mjs` (`npm run test:a11y:full`), which runs `supabase start`. `docs/guides/accessibility-checks.md` does warn against running it on the Mac. Adding it to the list in `AGENTS.md` is a change to the agent rules, so it was left for Omar.
- Issue 158 waits only for one signed-in check of the workspace in Dublin.

## Decisions needed from me

1. Supabase dashboard, Auth settings (issue 138). Recommendation unchanged: minimum length 8, leaked password protection on if the plan allows, secure email change on, redirect URLs limited to the site's own addresses, Turnstile enforced.
2. Require the Cold-start browser journey and Accessibility checks on `main` (issue 168). Recommendation: require both.
3. Privacy policy (issue 140). Recommendation: add the hosting region wording posted on the issue when approving the draft.
4. Carried from 22 November: licence image sources (144), rate limit thresholds (141), retention periods (142), backups (145), qualified review (148).

## Follow-ups

| Issue | Subject | Status |
| --- | --- | --- |
| 138 | Tracking issue for the 22 November review | Open: dashboard settings, published policy |
| 139 | Account deletion, data export and photo removal | Open |
| 140 | Publish the privacy policy and terms | Open; hosting region note added |
| 141 | Shared rate limits and spend management | Open |
| 142 | Audit administrator deletions; retention | Open; pull request 167 pending |
| 143 | Enforce the full content security policy | Open |
| 144 | Licence and image sources | Open; licence part done |
| 145 | Backups and a tested restore | Open |
| 146 | Automated accessibility checks | Open; CI run added in 162 |
| 147 | Low-severity hardening | Open; pull request 165 pending |
| 148 | Qualified legal review | Open |
| 166 | Workspace control borders at 3:1 | Open |
| 168 | Require the cold-start and accessibility checks on `main` | New |
