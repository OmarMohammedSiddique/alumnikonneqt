# Draft privacy policy and terms of use (23 November 2026)

Status: draft for Omar's approval. Nothing here is published. The live privacy page is unchanged apart from one sentence naming Speed Insights.

This is not legal advice. The points marked "For a qualified person" at the end need review by someone qualified in Kenyan data protection law before real alumni are invited at scale.

## Before this can be published

1. Approve or change the wording below.
2. Confirm the contact address. The draft uses `support@alumnikonneqt.com`, which arrives with the contact page in pull request 135. That pull request should merge first.
3. Confirm the retention periods. The database does not yet delete anything on a schedule, so the policy must not promise a period until a clean-up job exists (see the follow-up issue on retention). Until then the draft says what is true today.
4. Decide whether the page keeps the "Proposed association privacy notice" section. The draft drops it, because a policy should describe this service as it is.

## Draft privacy policy

### Who runs this service

AlumniKonneQt is an independent academic prototype built by Omar Siddique as a capstone project at Strathmore University, Nairobi. It is not an official Kenya Airways service and is not run by an alumni association. Omar Siddique decides how your information is used and is the person to contact about it: support@alumnikonneqt.com.

### What we collect and why

| Information | Why | Where it is kept |
| --- | --- | --- |
| Name, email address, password (stored only as a hash by Supabase Auth) and your chosen role | To create your account and sign you in | Supabase (database region: Ireland, EU) |
| Google account name, email and profile picture address, if you choose Google sign-in | To sign you in without a password | Supabase |
| Profile details you enter: headline, biography, skills, industry, graduation year, availability and an optional photo | To show your profile to other signed-in members and to recommend mentors | Supabase database and private file storage |
| A numerical summary of your profile text (an embedding) | To rank mentors by similarity to your goals. It is computed on our server, not by an outside AI service | Supabase |
| Mentorship requests and the message you write with them | To deliver the request to the mentor you chose | Supabase |
| Contact details you choose to share with a connection | To let you and your mentor or mentee reach each other after a request is accepted | Supabase |
| Blocks and reports you submit, and reports about you | To keep members safe. Only staff can read reports. The person you report or block is not told | Supabase |
| A record of role changes, visibility changes, request decisions and report reviews | To be able to check who did what if something goes wrong | Supabase |
| Email preferences, a queue of activity emails and a list of addresses that bounced or complained | To send the emails you asked for and stop sending to addresses that fail | Supabase |

A CV you upload to fill your profile is read in memory and then discarded. It is not stored.

Do not enter national ID, passport or staff identification numbers anywhere, or upload photographs of identity documents.

### Who else handles your information

| Company | What it does for us | What it receives |
| --- | --- | --- |
| Supabase | Database, sign-in and file storage | Everything in the table above |
| Vercel | Hosts the website | Your IP address and the pages you request, as any web host does. With your consent: anonymous page view and page speed measurements, without cookies |
| Resend | Sends email | Your email address and the content of each email |
| Google | Sign-in, only if you choose it | What Google needs to confirm who you are |
| Cloudflare Turnstile | Blocks automated sign-ups | Browser and connection signals such as your IP address |
| Sentry | Receives technical error reports | Error text, page path and browser type. Email addresses are masked and your IP address is not stored. Sentry records an approximate city and country |

We do not sell your information and do not use it for advertising. Some of these companies process information outside Kenya.

### Staff access

Moderators and administrators can see all profiles, including hidden ones, and can read reports. They cannot read your password. There are currently no staff accounts other than the developer.

### Emails

We send account emails (confirmation, password reset) because the account cannot work without them. We also send activity emails about requests, connections and recommendations. These are on by default and you can turn each kind off at any time under Profile, Email preferences, or with the unsubscribe link in each email. Reminder emails are sent only if you opt in.

### Cookies and browser storage

| Name | Kind | Purpose |
| --- | --- | --- |
| Supabase session cookies (`sb-...-auth-token`) | Necessary | Keep you signed in |
| `alumnikonneqt-google-next` | Necessary | Remembers where to send you after Google sign-in. Removed when sign-in finishes |
| `alumnikonneqt-email-otp`, `alumnikonneqt-confirm-email`, `alumnikonneqt-recover-email` | Necessary | Hold the address you are confirming for a few minutes during sign-up, sign-in by code or password reset |
| `alumnikonneqt-cookie-consent` (browser storage) | Necessary | Remembers your cookie choice |
| `alumnikonneqt-theme` (browser storage) | Functional, only with consent | Remembers light or dark mode |
| `ak-demo-presenter` | Necessary, presenters only | Set only for a presenter who unlocks the demonstration account switcher |

Analytics and page speed measurement set no cookies and stay off until you accept them.

### How long we keep it

Your account, profile, requests, connections, blocks and reports are kept until you ask us to delete your account. When you ask, we delete your account and the rows linked to it within 30 days. Records of actions such as role changes and report reviews are kept; they hold an internal account number that no longer matches any account once yours is deleted. We do not yet delete older records automatically.

### Your choices and rights

You can see and correct your profile at any time, hide it from other members, and change your email preferences. To get a copy of your information, to have your account deleted, or to object to how we use it, email support@alumnikonneqt.com from the address on your account. We answer within 30 days. Self-service deletion is planned.

Under Kenya's Data Protection Act, 2019 you may also complain to the Office of the Data Protection Commissioner.

### Identity is not verified

Signing up and confirming an email address does not prove that someone worked for an airline or belongs to an association. Treat other members accordingly.

### Changes

We will change this page when the service changes and show the date of the last change at the top.

## Draft terms of use

1. **What this is.** AlumniKonneQt is an academic prototype for alumni mentorship. It may change, lose data or be switched off without notice. Do not rely on it for anything important.
2. **Who can use it.** You must be 18 or older. Use your own name and your own email address. One account per person.
3. **Your content.** You are responsible for what you put in your profile and messages. You keep ownership of it, and you allow us to store and show it to other signed-in members so the service can work.
4. **Community rules.** Be respectful. No harassment, hate, threats, sexual content, spam, selling, recruiting for unrelated schemes, impersonation, or posting other people's private information. Do not share identity numbers or documents.
5. **Mentorship is voluntary.** Mentors give their own opinions in their own time. Nothing here is professional, legal, financial or medical advice, and no outcome is promised. Recommendations are suggestions made by software and can be wrong.
6. **Safety.** You can block or report any member. We may hide a profile, remove content or close an account that breaks these rules, and we may do so without notice where safety requires it.
7. **Meeting people.** We do not verify members. Take the usual care when you share contact details or meet someone.
8. **Not affiliated.** The project is inspired by the Kenya Airways alumni community. It is not owned, run or endorsed by Kenya Airways.
9. **Liability.** The service is provided as it is, free of charge, with no guarantee. To the extent the law allows, the developer is not liable for loss arising from its use.
10. **Leaving.** You can stop using the service at any time and ask for your account to be deleted, as the privacy policy explains.
11. **Law.** These terms are governed by the laws of Kenya.
12. **Contact.** support@alumnikonneqt.com

## Where the links go

- Sign-up form: "By creating an account you agree to the Terms of use and have read the Privacy policy", both linked. No pre-ticked boxes.
- Sign-up form, one line under the email field: "We will email you about requests and connections. You can turn these off in your profile."
- Footer of every page: Privacy policy, Terms of use, Cookie settings.

## For a qualified person

- Whether the developer must register with the Office of the Data Protection Commissioner as a data controller before inviting real alumni.
- Whether sending information to processors outside Kenya needs further safeguards or consent.
- Use of the Kenya Airways name and imagery, and the wording of the non-affiliation notice.
- Whether the liability clause is enforceable as written.
- Whether an age check is needed beyond the statement that members must be adults.
