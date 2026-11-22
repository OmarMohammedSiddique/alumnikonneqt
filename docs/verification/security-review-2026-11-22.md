# Security and launch review, 22 November 2026

Scope: the whole application at commit `b1d2cf5` on `main`, the full git history (219 commits), the live site at https://alumnikonneqt.com, and the GitHub, Supabase and Vercel settings. Both parts were run: 32 security checks and 13 privacy, legal and accessibility checks.

Stack: Next.js 16 (App Router, `proxy.ts`, Server Actions), Supabase (Postgres, Auth, Storage, pgvector), Vercel, Resend, Sentry, Cloudflare Turnstile. Features present: accounts, an admin area, photo and CV uploads, a Resend webhook, user-written profiles and messages, cookieless analytics. No payments and no paid AI API (the models run on the server).

Result: no critical or high security flaw. Two high privacy gaps (the privacy policy and account deletion) remain open with issues. Fixes are on branch `fix/security-review`, tracked in issue 138.

Audit date 22 November 2026; fixes and verification 23 November 2026. This is not legal advice.

## Summary

Status is what the audit found: "Found" means a flaw or gap exists, "Not found" means the check passed. Fixed says what has happened since.

### Part 1: security

| # | Check | Status | Severity | Fixed |
| --- | --- | --- | --- | --- |
| 1 | Committed secrets and `.env` files | Not found | None | Not needed |
| 2 | Secrets in client-side code | Not found | Low | No: `server-only` guards in issue 147 |
| 3 | Publicly served files | Not found | Low | Partly: `robots.txt` and `security.txt` in issue 147 |
| 4 | Debug mode and verbose errors | Not found | None | Not needed |
| 5 | Password storage | Not found | None | Not needed |
| 6 | Password strength and breach checks | Found | Medium | No: needs the Supabase dashboard (issue 138) |
| 7 | Email verification | Not found, settings to confirm | Low | No: secure email change to confirm in the dashboard |
| 8 | Brute force and login abuse | Not found, settings to confirm | Low | No: hosted rate limits and Turnstile enforcement to confirm |
| 9 | Password reset and magic links | Not found, settings to confirm | Low | No: redirect allowlist to confirm |
| 10 | Session token storage and lifetime | Not found | Low | No: demo cookie on sign-out in issue 147 |
| 11 | CSRF | Not found | Low | No: explicit Origin check in issue 147 |
| 12 | Row-level security and storage policies | Found | Medium | Yes, in the branch |
| 13 | Server-side permission checks | Found | Low | Yes, in the branch |
| 14 | Insecure direct object references | Not found | None | Not needed |
| 15 | Mass assignment | Found | Medium | Yes, in the branch |
| 16 | Least privilege and environments | Found | Medium | Accepted and documented |
| 17 | Server-side input validation | Found | Low | Yes, in the branch |
| 18 | Injection | Not found | None | Not needed |
| 19 | Cross-site scripting | Not found | None | Not needed |
| 20 | SSRF and open redirects | Not found | None | Not needed |
| 21 | File uploads | Not found | Low | No: photo removal in issue 139 |
| 22 | Security headers and HTTPS | Found | Medium | Yes, in the branch; full policy enforcement in issue 143 |
| 23 | CORS | Not found | None | Not needed |
| 24 | Rate limiting and bot protection | Found | Medium | No: accepted for now, issue 141 |
| 25 | Webhook signature verification | Not found | Low | No: durable replay record in issue 147 |
| 26 | Cost controls and AI endpoints | Not applicable | None | Spend management in issue 141 |
| 27 | Vulnerable dependencies | Not found | None | Not needed |
| 28 | Unused packages, lockfile, repo protections | Found | Medium | Yes, settings applied |
| 29 | Sensitive data in logs and analytics | Not found | None | Not needed |
| 30 | Audit logging | Found | Low | Partly: issue 142 |
| 31 | Backups and recovery | Needs my decision | Low | No: issue 145 |
| 32 | Secret inventory | Found | Low | Yes, `docs/guides/secrets.md` |

### Part 2: privacy, legal and accessibility

| # | Check | Status | Severity | Fixed |
| --- | --- | --- | --- | --- |
| P1 | Privacy policy | Found | High | Draft written, not published: issue 140 |
| P2 | Terms and conditions | Found | Medium | Draft written, not published: issue 140 |
| P3 | Cookies and consent | Not found | Low | Cookie table corrected in the draft |
| P4 | Forms, consent and data minimisation | Found | Medium | Partly: unsubscribe header added, rest in issue 140 |
| P5 | Analytics and third-party embeds | Found | Low | Yes: Speed Insights added behind consent |
| P6 | Data export and deletion | Found | High | No: issue 139 |
| P7 | Refund and cancellation policy | Not applicable | None | Nothing is sold |
| P8 | Business details | Found | Low | Contact page is in pull request 135; controller named in the draft policy |
| P9 | Honest content | Found | Medium | Yes, in the branch |
| P10 | Image, font and code licensing | Found | Medium | No: issue 144 |
| P11 | Accessibility: content | Found | Medium | Yes on `main`; contact page branch in issue 146 |
| P12 | Accessibility: interaction | Found | Medium | Yes for the dialogs; wider coverage in issue 146 |
| P13 | Applicable laws and other legal risks | Needs my decision | Not rated | No: issue 148 |

## Part 1: findings

### 1. Committed secrets and `.env` files

- Status: Not found. Severity: none.
- Evidence: no `.env*` file other than `.env.example` has ever been tracked. `gitleaks` over all 219 commits gave 9 hits, all false: SHA-256 hashes in ML manifests and documents, and a test fixture in `lib/email-webhook.test.mjs`. GitHub secret scanning alert 1 is resolved as used in tests. `.gitignore` covers `.env*` and keeps `.env.example`.

### 2. Secrets in client-side code

- Status: Not found. Severity: none.
- Evidence: a production build was searched for key patterns. The client output holds only the Supabase anon key, which is public by design. No `NEXT_PUBLIC_` variable holds a secret. The service role key is read only in server modules.
- Open: `lib/notification-worker.ts` and `lib/email-delivery.ts` lack the `server-only` guard. Both are imported only by server code today. Adding the guard needs a change to how the unit tests load modules, which broke three unrelated test files when tried, so it is deferred (issue 147).

### 3. Publicly served files

- Status: Not found. Severity: low.
- Evidence: on the live site `/.env`, `/.git/config`, `/package.json`, `/preview/*` and `/demo` return 404, and no source maps are served.
- Open: there is no `robots.txt` or `security.txt` (issue 147).

### 4. Debug mode and verbose errors

- Status: Not found. Severity: none.
- Evidence: handlers return generic messages; details go to Sentry on the server. No stack traces, SQL errors or file paths reach the client.

### 5. Password storage

- Status: Not found. Severity: none.
- Evidence: Supabase Auth stores passwords. There is no password column in the `public` schema and passwords are not logged.

### 6. Password strength and breach checks

- Status: Found. Severity: medium.
- Locations: Supabase dashboard, Auth settings. `supabase/config.toml` sets a minimum of 6 for the local stack.
- Risk: weak or already leaked passwords are accepted.
- Evidence: the Supabase security advisor reports leaked password protection as disabled. The hosted minimum length could not be read through the API.
- Fix: not applied. In the dashboard, set the minimum length to 8, the rule in `lib/signup-validation.ts`, and turn on leaked password protection if the plan allows.
- Verification: pending.

### 7. Email verification

- Status: Not found. Severity: low.
- Evidence: the hosted project has email confirmation on (`mailer_autoconfirm` false). The proxy and every action call `getUser()`, so an unconfirmed account has no session.
- Open: "Secure email change" could not be read through the API; confirm in the dashboard.

### 8. Brute force and login abuse

- Status: Not found, with settings to confirm. Severity: low.
- Evidence: sign-in, sign-up and password reset carry Turnstile tokens that Supabase Auth verifies. Responses do not reveal whether an email exists. Supabase applies its own auth rate limits.
- Open: the hosted rate limit values and Turnstile enforcement need confirming in the dashboard.

### 9. Password reset and magic links

- Status: Not found, with settings to confirm. Severity: low.
- Evidence: Supabase issues single-use, expiring tokens. Redirect targets inside the app go through `lib/auth-redirect.ts`, which accepts relative paths only.
- Open: the hosted redirect URL allowlist needs confirming in the dashboard.

### 10. Session token storage and lifetime

- Status: Not found. Severity: low.
- Evidence: `@supabase/ssr` keeps the session in cookies. No token is written to `localStorage`. The server never relies on `getSession()`.
- Open: signing out leaves the presenter cookie `ak-demo-presenter` (issue 147).

### 11. CSRF

- Status: Not found. Severity: low.
- Evidence: session cookies are `SameSite=Lax`, no GET request changes state, and Server Actions check the origin.
- Open: four cookie-authenticated POST route handlers rely on SameSite alone (issue 147).

### 12. Row-level security and storage policies

- Status: Found. Severity: medium.
- Locations: `supabase/migrations/20261105000001_profile_privacy_reporting_blocking.sql` (reports policies), `20260705000001_initial_schema.sql` (grants).
- Risk: a member could file a report already marked as reviewed. The anonymous role held every table privilege, including TRUNCATE, which row-level security does not cover; nothing exposed it, but it was one mistake away from mattering.
- Evidence: row-level security is on for all 10 public tables with no `USING (true)` policy, and with the anon key every table returned nothing or a permission error. The reports INSERT policy checked only the reporter. On the hosted project `anon` and `authenticated` held all privileges on six tables. The profile-photos bucket is private, limited to 512 KB and to JPEG, PNG and WebP.
- Advisor warnings: leaked password protection off (check 6); seven SECURITY DEFINER functions callable by signed-in users (intended, each checks the caller); `email_outbox` and `email_suppressions` have row-level security with no policy (intended, service role only).
- Fix: migration `20261123090000_launch_review_hardening.sql`. Reports accept only the four member columns and must be pending and unreviewed. Staff change reports only through `review_report()`. All privileges are revoked from `anon` on member tables, and TRUNCATE, REFERENCES, TRIGGER and audit log writes are revoked from `authenticated`.
- Verification: TEST 21b, 21d and 21e in `supabase/tests/rls_tests.sql` pass on the dev database, with all six database suites.
- Open: `is_blocked_with` reveals a block to the blocked member (issue 147). No DELETE policy on photos (issue 139).

### 13. Server-side permission checks

- Status: Found. Severity: low (rated medium in the audit, lowered after testing).
- Locations: `review_report` and `protect_profile_columns`.
- Risk: both compared the caller's role with a list. A signed-in account with no profile row has a NULL role, and `NULL not in (...)` is NULL, which an IF treats as false, so the staff check did not reject it.
- Evidence: before the fix, TEST 21a showed such an account passing the staff check. It then failed on a foreign key (`reviewed_by` must be a profile), so no report could actually be changed. No such account exists on the hosted project. Every server action and route handler re-checks the user and role on the server; roles live in `profiles`, not in user-editable metadata.
- Fix: both functions now treat a NULL role as not staff.
- Verification: TEST 21a passes and confirms the rejection is the staff check, not the foreign key.

### 14. Insecure direct object references

- Status: Not found. Severity: none.
- Evidence: every read or write by ID is scoped by the caller in the query and again by row-level security. IDs are UUIDs.

### 15. Mass assignment

- Status: Found. Severity: medium.
- Location: policy "requests: mentee cancels own pending" in `20260705000001_initial_schema.sql`.
- Risk: the policy checked only the new status, so a mentee cancelling through the API directly could also rewrite the mentor, the message or the creation time of the request.
- Fix: `authenticated` may update only the `status` column of `mentorship_requests`, and may set only the ID, mentee, mentor and message when creating a request, so a request cannot be backdated to trigger an early reminder.
- Verification: TEST 21c shows a message rewrite, a mentor change and a backdated request refused, and a plain cancel still working.

### 16. Least privilege and environments

- Status: Found. Severity: medium.
- Evidence: the service role key is set for Production only, and every use of it performs its own authorisation. Preview and Development scopes in Vercel use the production Supabase URL and anon key, so a preview build reads and writes production data. `SENTRY_AUTH_TOKEN` is present in every environment.
- Fix: accepted on 23 November 2026 because previews sit behind Vercel sign-in. Recorded in `docs/guides/secrets.md`.

### 17. Server-side input validation

- Status: Found. Severity: low.
- Location: `executeUpdateVisibility` in `lib/profile-privacy.ts`.
- Risk: the action passed its argument to the update without checking its type. The database column is boolean, so the effect was limited to an unhelpful error.
- Fix: non-boolean input is rejected before the database is touched.
- Verification: a unit test in `lib/profile-privacy.test.mjs`.

### 18. Injection

- Status: Not found. Severity: none.
- Evidence: no SQL is built from strings, no PostgREST filter string is built from user input, and there is no shell execution, `eval` or path built from input.

### 19. Cross-site scripting

- Status: Not found. Severity: none.
- Evidence: the only `dangerouslySetInnerHTML` is the constant theme bootstrap script. User-supplied links pass through `lib/connection-journey.ts`, which allows only `https` links and plain email addresses.

### 20. SSRF and open redirects

- Status: Not found. Severity: none.
- Evidence: the server fetches no user-supplied URL. `next` parameters are limited to relative paths.

### 21. File uploads

- Status: Not found. Severity: low.
- Evidence: photos and CVs are checked by content and size, CVs are parsed in memory within a decompression budget and never stored, and photo names are generated on the server.
- Open: a member cannot remove a photo (issue 139).

### 22. Security headers and HTTPS

- Status: Found. Severity: medium.
- Location: `next.config.ts` had no `headers()`.
- Risk: without a frame rule the site could be embedded for clickjacking; without a content policy an injected script would run unrestricted.
- Evidence: `curl -I https://alumnikonneqt.com` showed HSTS without `includeSubDomains`, `x-powered-by: Next.js`, and none of Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy or Permissions-Policy. HTTP and `www` redirect correctly.
- Fix: `lib/security-headers.ts` sends all of them on every response and `x-powered-by` is off. The enforced policy holds `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. The full policy is sent report-only.
- Verification: unit tests; `curl -I` against the local server shows every header; the landing, sign-in and sign-up pages load with no policy violation in the console. Live verification follows the merge.
- Open: enforce the full policy (issue 143).

### 23. CORS

- Status: Not found. Severity: none.
- Evidence: no route sets `Access-Control-Allow-Origin`.

### 24. Rate limiting and bot protection

- Status: Found. Severity: medium.
- Locations: `/api/embed`, `/api/match/compare`, `/api/cv/extract` (in-memory limits); `/api/match`, `createRequest`, `reportMemberAction`, `unlockDemoMode` (none).
- Risk: each server instance counts separately, so the limits are weaker than they read, and the unlimited actions can be scripted by a signed-in member.
- Fix: none. Accepted for now on 23 November 2026 because adding Upstash is a new service for 8 accounts. Issue 141 holds the work and the threshold decision. No Vercel Firewall rules exist.

### 25. Webhook signature verification

- Status: Not found. Severity: low.
- Evidence: the Resend webhook verifies the HMAC over the raw body with a 300 second tolerance before reading the payload. The worker endpoint compares its bearer secret in constant time.
- Open: replayed event IDs are remembered in memory only (issue 147).

### 26. Cost controls and AI endpoints

- Status: Not applicable. The models run on the server with ONNX; no paid AI API is called. Vercel spend management was not confirmed and is part of issue 141.

### 27. Vulnerable dependencies

- Status: Not found. Severity: none.
- Evidence: `npm audit` reports 0 vulnerabilities.

### 28. Unused packages, lockfile and repository protections

- Status: Found. Severity: medium.
- Evidence: `knip` found no unused dependency and the lockfile is committed. Code scanning is on and the "Protect main" ruleset requires a pull request and three checks. Push protection and Dependabot security updates were off, merge commits and rebase merges were allowed, and merged branches were kept.
- Fix: applied on 23 November 2026: secret scanning push protection on, Dependabot security updates on, squash merge only, branches deleted on merge.
- Verification: the repository API returns the new values.
- Open: the public repository has no licence (issue 144).

### 29. Sensitive data in logs, errors and analytics

- Status: Not found. Severity: none.
- Evidence: Sentry sends no cookies, headers, bodies, query strings or user details, masks email addresses, and runs in the browser only after analytics consent. Analytics events carry no identifiers.

### 30. Audit logging

- Status: Found. Severity: low.
- Evidence: role changes, visibility changes, request decisions and report reviews are written by triggers and functions to `audit_logs`, which members cannot read or write. Administrator deletions are not recorded, and staff could edit a report directly without a record.
- Fix: direct report edits are removed, and audit log writes are revoked from `authenticated` (check 12). Deletions are in issue 142.

### 31. Backups and recovery

- Status: Needs my decision. Severity: low.
- Evidence: the backup schedule of the hosted plan was not confirmed and no restore has been tested. Issue 145.

### 32. Secret inventory

- Status: Found. Severity: low.
- Fix: `docs/guides/secrets.md` lists every secret by name, where it lives and how to rotate it. No value is recorded.

## Part 2: findings

### P1. Privacy policy

- Status: Found. Severity: high.
- Location: `app/(auth)/privacy/page.tsx`.
- Risk: members are not told who holds their data, which companies receive it or how to have it removed, which Kenya's Data Protection Act requires.
- Evidence: the page omits Resend and Vercel hosting; request messages, shared contact details, reports, blocks, audit logs, email records, embeddings and staff access; retention; a named controller; and a rights procedure. It asks visitors to use test details while real alumni are invited. It lists 3 of the 8 cookies and storage keys.
- Fix: a full draft is in `docs/notes/2026-11-23-privacy-policy-and-terms-draft.md`. It is not published; legal text needs Omar's approval (issue 140).

### P2. Terms and conditions

- Status: Found. Severity: medium.
- Evidence: there are no terms although the app has accounts, user-written content and reporting.
- Fix: drafted in the same document, not published (issue 140).

### P3. Cookies and consent

- Status: Not found. Severity: low.
- Evidence: nothing optional is set before a choice is made, and rejecting is as easy as accepting. Analytics is cookieless and still waits for consent.
- Open: the cookie list on the page is incomplete; the draft policy corrects it.

### P4. Forms, consent and data minimisation

- Status: Found. Severity: medium.
- Evidence: forms collect only what they need. Activity emails are on by default with no notice at sign-up, unsubscribing needs sign-in, and emails had no `List-Unsubscribe` header.
- Fix: activity emails now carry `List-Unsubscribe` pointing at the preferences page. The sign-up notice and one-click unsubscribe are in issue 140.
- Verification: unit tests in `lib/notification-email.test.mjs` and `lib/email-delivery.test.mjs`.

### P5. Analytics and third-party embeds

- Status: Found. Severity: low.
- Evidence: fonts are self-hosted and there are no embeds or pixels. Speed Insights, which the deployment standard asks for, was not installed.
- Fix: `@vercel/speed-insights` loads only after analytics consent, and the cookie settings, privacy page and README name it.
- Verification: in the browser, no Vercel script loads before consent and both load after accepting.
- Open: Speed Insights must also be switched on for the project in the Vercel dashboard.

### P6. Data export and deletion

- Status: Found. Severity: high.
- Evidence: there is no account deletion or export in the interface or the code, and a deleted account would leave its photo in storage.
- Fix: none yet. The draft policy offers deletion and export by email within 30 days. Self-service deletion is issue 139; scheduled retention is issue 142.

### P7. Refund and cancellation policy

- Not applicable. Nothing is sold.

### P8. Business details

- Status: Found. Severity: low.
- Evidence: `main` names the developer on the about page but gives no contact address for the service. Pull request 135 adds a contact page and a support address.

### P9. Honest content

- Status: Found. Severity: medium.
- Location: `app/(marketing)/about-developer/page.tsx`.
- Evidence: the page claimed a fine-tuned MiniLM, empirical data collection, security audits and passwordless sign-in. The app uses the pretrained MiniLM beside an experimental encoder trained on synthetic profiles, and signs in with a password or Google.
- Fix: the three passages now match the code.

### P10. Image, font and code licensing

- Status: Found. Severity: medium.
- Evidence: the public repository has no licence. No source is recorded for the images under `public/images/landing`, `auth` and `cursors`, `landing-preview.jpg` or `alumniconnect-demo.gif`.
- Fix: none. Omar must choose the licence and supply the sources (issue 144).

### P11. Accessibility: content

- Status: Found. Severity: medium.
- Location: `--input` in `app/globals.css`; form fields in `components/safety/report-dialog.tsx`.
- Evidence: in the dark theme control borders were 1.9:1 against the page. The report form fields used the decorative border colour, 2.75:1 in the light theme. WCAG asks for 3:1.
- Fix: the dark token gives 3.8:1 on the page and 3.5:1 on cards; the report fields use the control border token (10.8:1 in the light theme).
- Verification: ratios computed from the token values, and the production stylesheet carries the new value.
- Open: on the contact page branch the light theme border is about 2:1 (issue 146).

### P12. Accessibility: interaction

- Status: Found. Severity: medium.
- Location: `components/safety/report-dialog.tsx`, `block-dialog.tsx`.
- Evidence: the dialogs did not move focus inside, did not keep Tab inside, and did not return focus on closing. The page declares `lang="en"`.
- Fix: `lib/use-modal-focus.ts` gives both dialogs initial focus, a focus trap, Escape to close and focus return. The block dialog starts on Cancel. After a report is submitted, focus moves to the Done button and the confirmation is announced.
- Verification: in the browser, focus starts on the first field, stays inside the dialog through 9 Tab and 7 Shift+Tab presses, and returns to the safety menu button after Escape, for both dialogs.
- Open: automated axe coverage for the main pages (issue 146).

### P13. Applicable laws and other legal risks

- Status: Needs my decision. Not rated.
- Evidence: the developer and the intended members are in Kenya, so the Data Protection Act, 2019 applies; members abroad may bring other laws. The data is stored in the EU and handled by processors in the EU and the United States. Members write free text and can report each other. No payments, health or financial data.
- For a qualified person (issue 148): registration with the Office of the Data Protection Commissioner, transfers outside Kenya, the absence of an age check, and the use of the Kenya Airways name and imagery.

## Decisions needed from me

1. Supabase dashboard, Auth settings. Recommendation: minimum password length 8, leaked password protection on if the plan allows, secure email change on, redirect URLs limited to the site's own addresses, Turnstile enforced. These cannot be read or set through the tools used here.
2. Supabase project name. Recommendation: rename "AlumniConnect" to `alumnikonneqt-production` in Project Settings (approved on 23 November 2026; the tools used here cannot rename).
3. Vercel Speed Insights. Recommendation: switch it on for the project in the Vercel dashboard so the installed script has somewhere to report.
4. Draft privacy policy and terms (issue 140). Recommendation: approve after pull request 135 merges, with the "Proposed association privacy notice" section dropped.
5. Licence and image sources (issue 144). No recommendation on the licence: it is your choice. Recommendation on images: replace any whose source cannot be shown.
6. Rate limit thresholds (issue 141) and retention periods (issue 142). Recommendation: 10 requests a minute per member on the model routes and 5 reports an hour; audit logs 12 months, email outbox 90 days.

## Follow-ups

| Issue | Subject |
| --- | --- |
| 138 | Tracking issue for the fixes in this review |
| 139 | Account deletion, data export and photo removal |
| 140 | Publish the approved privacy policy and terms; sign-up notices; one-click unsubscribe |
| 141 | Shared rate limits and spend management |
| 142 | Audit administrator deletions; scheduled retention |
| 143 | Enforce the full content security policy |
| 144 | Licence and image sources |
| 145 | Backups and a tested restore |
| 146 | Automated accessibility checks on every main page |
| 147 | Low-severity hardening |
| 148 | Qualified review of data protection duties and the airline name |
