# Usability study with the System Usability Scale (SUS)

**Status: not yet approved and not yet run.** This guide holds the materials for a planned study. No participant has been recruited, no session has taken place and no SUS score exists. Nothing in this file is a result. The only numbers below are a worked scoring example, and they are labelled as made up.

## 1. Purpose

The report sets a usability requirement, NFR-03: a mean SUS score of at least 68. Test case TC-14 is the test of that requirement, and the report currently records it as not evaluated. GitHub issue 5 ("Plan and run representative-user usability testing with SUS") lists what the study must cover before that can change.

This guide gives Omar what he needs to run a small study with 5 to 10 people who would use AlumniKonneQt as Mentees or Mentors: participant criteria, consent wording, a session procedure, tasks, the questionnaire, scoring, recording sheets and data handling rules.

The study is formative. It looks for usability problems and gives an indicative SUS score for one identified release. It is not a final acceptance test and it says nothing about whether mentorship through the platform succeeds.

## 2. Agree with the supervisor before recruiting

Do not contact participants or collect any data until each point is agreed. Record the agreement (date and what was agreed) in a comment on issue 5. Do not record an approval that has not been given.

- [ ] The supervisor agrees that the study should run, and on its scope.
- [ ] Confirm whether an ethics or research approval process applies to this study at the university. If one applies, complete it first.
- [ ] Who may be recruited and how they will be approached (section 3).
- [ ] The consent wording in section 4, including the retention period and the contact for withdrawal.
- [ ] The task list in section 6 and the target session length (about 30 to 40 minutes).
- [ ] Which environment participants use: the hosted site or a separate test deployment. The hosted site shares its database with any real members.
- [ ] How test accounts get email addresses, so that participants do not use a personal address (section 5).
- [ ] Where private material is kept (consent records, any list that links a person to a participant code), who can read it and when it is destroyed.
- [ ] Whether a pilot session with one person is run first, and that pilot data is kept out of the analysed set if the procedure changes afterwards.

## 3. Participants

### Criteria

- Adults who could realistically use the platform in one of its two roles: a Mentee looking for career guidance, or a Mentor with work experience to share.
- Able to use a web browser without help.
- Not involved in building or testing AlumniKonneQt, and not shown the interface beforehand.
- Aim for both roles to be represented, for example three or more people in each role if 6 or more take part.

### Sample size

Five to ten participants is what is attainable before the defence, and it is a common size for formative usability testing, where the aim is to find the main problems. A SUS mean from a sample of this size is indicative only.

State the limit plainly in the report: a sample of this size cannot support statistical generalisation. The mean describes these participants on this release. It is not an estimate for all alumni or all users, and no significance test against 68 should be claimed.

### What to record about each participant

Record only what is needed to interpret the results. Do not record names, email addresses, phone numbers, employers, job titles, ages or anything else that identifies a person.

| Field | Values |
| --- | --- |
| Participant code | P01, P02, P03 and so on, in session order |
| Role played | Mentee or Mentor |
| Familiarity with similar platforms (for example professional networking or mentoring sites) | None, some, or regular use |

## 4. Information and consent wording

Give this to each participant to read before the session starts. Fill in the bracketed parts once they are agreed with the supervisor. Consent can be signed or spoken, as agreed. Signed forms are stored privately and never added to the repository.

> **About this study**
>
> I am a final-year student. AlumniKonneQt is a prototype website I built for my capstone project. It helps Mentees find Mentors. It is an independent academic prototype and not an official product.
>
> I am testing the website, not you. There are no right or wrong answers. If something is hard to do, that is useful for me to know.
>
> **What you will do.** You will try a few tasks on the website, such as creating an account and filling in a profile. Then you will answer ten short questions about how easy the website was to use. After that we will talk briefly about your experience. The session takes about [30 to 40] minutes.
>
> **Taking part is your choice.** You can skip any task or question. You can stop at any time without giving a reason, and nothing will happen as a result.
>
> **What I record.** For each task I note whether it was completed, whether help was needed, any errors, roughly how long it took and anything that seemed difficult. I record your ten answers. I record whether you acted as a Mentee or a Mentor and how familiar you are with similar websites. I do not make audio, video or screen recordings [unless agreed, in which case say so here].
>
> **No names are kept.** My notes use a code such as P03, not your name. Your name, contact details and employer are not written in the notes or in my report.
>
> **Use made-up details.** You will use a test account and fictional details. Please do not type real personal information into the website beyond what you choose to. Do not enter real identity numbers and do not upload your own CV.
>
> **How the results are used.** The de-identified scores and task outcomes go into my project report and project files. Individual answers are reported only by participant code.
>
> **How long data is kept.** De-identified results are kept with the project. Consent records and any note that could link you to your code are kept privately and destroyed by [date or period agreed with supervisor].
>
> **Withdrawing.** You can ask me to remove your data until [date]. Contact me at [contact detail] and give your participant code, or ask me to look it up. After that date the results will already be combined in the report.
>
> **Consent.** I have read this information, I have had the chance to ask questions and I agree to take part.

## 5. Session procedure for the facilitator

### Before each session

1. Record the version under test: the release tag (for example `git describe --tags`), the commit hash, the URL tested and the date. Use one identified stable release for every session. If a consequential change is deployed part way through, record it and repeat the affected tasks.
2. Record the participant's device, operating system, browser and whether the session is in person or remote.
3. Prepare a fresh fictional account identity for the participant: a made-up name and a study email address that Omar controls. Registration may ask for an email confirmation ("Check your email"), so the address must be able to receive it. Participants should not use a personal email address and should not use "Sign in with Google".
4. Do not use the one-click demo account switcher (the "Demo mode" panel described in `docs/guides/demo-mode.md`) for participants. It exists for presentations, it skips registration and sign-in, and its accounts already have complete profiles, so it would hide the parts of the interface the study needs to test.
5. Seed the data the tasks need, using fictional accounts only:
   - For a Mentor participant: after they finish task 2, send their account three requests from three fictional Mentee accounts. Two are for task 5. The third is set aside as the member to report and block in task 7, and the scenario for task 5 should name the two people to answer so that the third request is left alone.
   - For a Mentee participant: have at least three fictional Mentor profiles visible, one of which is set aside as the profile to report and block in task 7. Be ready to accept the participant's request from a fictional Mentor account in a separate browser after task 4.
   - The participant registers an ordinary account, so these seeded accounts must be ordinary accounts too. Do not use the demo mode accounts or any account marked `app_metadata.fictional`: the database keeps demo accounts and real members apart, so the participant would not see them or be able to send them a request (see `docs/guides/demo-mode.md`).
6. Prepare a fictional sample CV (PDF or Word .docx, under 4 MB) for anyone who wants to try the CV upload.

### Order of the session

1. **Consent.** The participant reads section 4 and agrees.
2. **Tasks.** Read each scenario from section 6 aloud exactly as written and hand over a printed copy. One task at a time.
3. **SUS.** Give the questionnaire in section 7 straight after the last task, before any discussion.
4. **Debrief.** Only now ask open questions: what was hardest, what was unclear, what they expected to happen. Answer their questions.

### Rules during tasks

- Stay neutral. Do not name buttons, point at the screen or explain how the interface works.
- If the participant asks what to do, reply: "What would you do if I were not here?"
- Thinking aloud is optional. Invite it once ("You are welcome to say what you are thinking as you go") and do not insist.
- Give help only when the participant is stuck and asks to move on, or after about three minutes without progress. Give the smallest hint that works, and record the task as completed with help.
- If the participant gives up, record the task as not completed and move on without comment.
- The sign-up and sign-in forms may show a bot check. The participant completes it themselves. Note it if it causes difficulty.
- Do not react to errors, and do not defend the design.

### After each session

- Check the recording sheet is complete and uses only the participant code.
- Remove the session's test data where practical: unblock members under "Blocked Members" on the profile page, and clear the test report from the Administration queue.

## 6. Tasks

Mentee participants do tasks 1, 2, 3, 4, 6, 7 and 8. Mentor participants do tasks 1, 2, 5, 6, 7 and 8. The scenarios avoid the interface's own wording on purpose. The success criteria use the labels as they appear in the app, for the facilitator only.

For every task record: outcome (completed unaided, completed with help, or not completed), number of errors (wrong paths, failed submissions, validation messages), time from the end of the scenario reading to completion or abandonment, and observed difficulty in a short note.

| No. | Role | Scenario read to the participant | Success criterion (facilitator only) |
| --- | --- | --- | --- |
| 1 | Both | "You have heard about this website and want to join as a [Mentee or Mentor]. Using the name and email address on your card, become a member and get into your own area of the site." | An account is created from "Create your account" with the correct role chosen under "How would you like to take part?", submitted with "Create account", and the participant reaches the workspace (any email confirmation step and "Sign in" included). |
| 2 | Both | "Tell other members about yourself: what you do, what you are good at and what you are looking for or can offer. Use made-up details. A sample CV is on the desk if you would like to use it." | On "Your profile", at least Headline and Skills are filled in under "Professional details" and saved with "Save profile" ("Profile saved." is shown). Using "Fill from your CV" and "Read CV" is optional: record whether it was used. |
| 3 | Mentee | "See which people the website suggests for you. Pick one of them and tell me why you think the website is showing you that person." | On "Discover Mentors" the participant selects "Recommended" and reads out or paraphrases the explanation on a Mentor card (the "Shared skills: ..." line or the "No exact shared skills identified" line, and the note that similarity does not guarantee suitability). |
| 4 | Mentee | "You are interested in a career in [finance]. Look for someone with that background and ask them to guide you. Include a short note about what you hope to learn." | The participant uses "Keyword search", enters a term under "Search by name, skill, or field" and presses "Search", then on a result presses "Request mentorship", types an Introduction and presses "Send request" ("Request sent. Track the response on your requests page." is shown). |
| 5 | Mentor | "[Name one] and [name two] have asked for your guidance. Read what they wrote. Agree to help one of them and turn the other down." | On "Requests & connections" (page heading "Incoming requests") one request is answered with "Accept" and the other with "Decline". The accepted person appears under "Your connections". |
| 6 | Both | "You and the other person now need a way to talk outside the website. Give them a way to reach you, using the made-up contact on your card. Then imagine you have had your first chat, and make the website show that." | Under "Your connections" the participant enters a contact in the "Share a contact detail with [name]" field and presses "Share", then presses "Mark first conversation as held" (the card shows "First conversation held on [date]"). |
| 7 | Both | "The profile of [named fictional member] looks fake to you. Let the people who run the website know. Then make sure this person cannot contact you again." | From the "Safety options for [name]" menu on that member's card: "Report profile", a "Reason for report" chosen and "Submit report" pressed ("Report submitted" is shown); then "Block member" chosen and confirmed with "Block member" in the "Block [name]?" dialog. |
| 8 | Both | "You are getting more emails from the website than you want. Stop the ones that tell you about suggested people, and keep the rest." | From "Your profile" the participant follows "Manage email preferences or unsubscribe", unticks "Mentor recommendations" only, and presses "Save email preferences" ("Your email preferences have been saved." is shown). |

Notes for the facilitator:

- Task 3: Discover opens on "Compare models", not on "Recommended". Whether participants find the right mode is part of what the task observes.
- Task 4: replace [finance] with a field that the seeded fictional Mentor profiles actually contain.
- Task 6 for a Mentee: accept their request from the fictional Mentor account before reading the scenario.
- Task 7: use the fictional profile set aside for this. Never ask a participant to report or block a real member. A Mentee finds the safety menu on that Mentor's card on "Discover Mentors". A Mentor has no Discover cards, so the menu is on the request card of the third requester under "Incoming requests". Do not use the connection accepted in task 5: blocking that member would undo the state task 6 needs.

## 7. SUS questionnaire

Give this after the tasks and before the debrief. Use the standard wording (Brooke, 1996) without changes. "The system" means the AlumniKonneQt website. Ask the participant to answer every item and to mark the middle point if they cannot decide. Do not explain or rephrase items beyond clarifying a word if asked ("cumbersome" may be explained as "awkward").

Each item is rated on a five-point scale from 1 (Strongly disagree) to 5 (Strongly agree).

| No. | Statement | Strongly disagree 1 | 2 | 3 | 4 | Strongly agree 5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | I think that I would like to use this system frequently. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | I found the system unnecessarily complex. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | I thought the system was easy to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | I think that I would need the support of a technical person to be able to use this system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | I found the various functions in this system were well integrated. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | I thought there was too much inconsistency in this system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | I would imagine that most people would learn to use this system very quickly. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | I found the system very cumbersome to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | I felt very confident using the system. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | I needed to learn a lot of things before I could get going with this system. | ☐ | ☐ | ☐ | ☐ | ☐ |

Reference: Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan, B. Thomas, B. A. Weerdmeester and I. L. McClelland (eds), *Usability Evaluation in Industry*. London: Taylor and Francis.

## 8. Scoring

### Per participant

1. For each odd-numbered item (1, 3, 5, 7, 9): contribution = response minus 1.
2. For each even-numbered item (2, 4, 6, 8, 10): contribution = 5 minus response.
3. Add the ten contributions (the sum is between 0 and 40).
4. Multiply the sum by 2.5. The SUS score is between 0 and 100.

A SUS score is not a percentage. If a participant leaves an item blank, record it as blank, score it as 3 (the middle point, which Brooke asks respondents to mark when they cannot decide), and say in the report that this was done and for how many items.

### Worked example (MADE-UP illustration, not study data)

The responses below were invented to show the arithmetic. They do not come from any participant.

| Item | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MADE-UP response | 4 | 2 | 5 | 1 | 4 | 2 | 4 | 2 | 5 | 3 |
| Rule | 4 − 1 | 5 − 2 | 5 − 1 | 5 − 1 | 4 − 1 | 5 − 2 | 4 − 1 | 5 − 2 | 5 − 1 | 5 − 3 |
| Contribution | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 4 | 2 |

Sum of contributions = 32. SUS score = 32 × 2.5 = 80.

### Aggregate

With n genuine participant scores:

- **Mean:** add the scores and divide by n.
- **Median:** sort the scores. Take the middle one if n is odd, or the average of the two middle ones if n is even.
- **Standard deviation (sample):** subtract the mean from each score, square each difference, add the squares, divide by n − 1 and take the square root.
- **Minimum and maximum:** the lowest and highest scores.

MADE-UP illustration with five invented scores (80, 62.5, 72.5, 90, 55): mean = 360 ÷ 5 = 72; median = 72.5; squared differences sum to 767.5, divided by 4 gives 191.875, so the standard deviation is about 13.9; minimum 55; maximum 90.

Check every calculation twice: once by hand or in a spreadsheet, and once independently (for example a second spreadsheet built from the raw responses, or a short script). The two must agree before any figure goes into the report. Check that the number of scores analysed equals the number of sessions actually run.

### The benchmark of 68

68 is the commonly cited average SUS score across many published studies (Sauro, 2011), which is why NFR-03 uses it as the target. It marks an average result, not a pass mark for good usability. Report the mean beside the median, standard deviation, minimum, maximum and n, and say whether the mean is above or below 68 without claiming statistical significance.

Reference: Sauro, J. (2011). Measuring usability with the System Usability Scale (SUS). MeasuringU. Check this reference against the source before citing it in the report.

## 9. Recording sheets

Copy these tables for use. Leave them blank here.

### Per-participant sheet

| Field | Entry |
| --- | --- |
| Participant code | |
| Date | |
| Role played (Mentee or Mentor) | |
| Familiarity with similar platforms (none, some, regular) | |
| Release tag and commit | |
| URL tested | |
| Device, operating system and browser | |
| In person or remote | |

| Task | Outcome (unaided / with help / not completed) | Errors | Time (min:sec) | Help given | Observed difficulty |
| --- | --- | --- | --- | --- | --- |
| 1 Create account and sign in | | | | | |
| 2 Complete profile (CV upload used: yes / no) | | | | | |
| 3 Suggested Mentors and reason (Mentee) | | | | | |
| 4 Search and send request (Mentee) | | | | | |
| 5 Respond to requests (Mentor) | | | | | |
| 6 Share contact and mark first conversation | | | | | |
| 7 Report and block | | | | | |
| 8 Email preferences | | | | | |

| SUS item | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Sum of contributions | SUS score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Response (1 to 5) | | | | | | | | | | | | |
| Contribution | | | | | | | | | | | | |

Debrief notes (no names, no identifying details):

### Summary table

| Participant | Role | Familiarity | Tasks attempted | Completed unaided | Completed with help | Not completed | SUS score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | | | | | | | |
| P02 | | | | | | | |
| P03 | | | | | | | |
| P04 | | | | | | | |
| P05 | | | | | | | |

| Measure | Value |
| --- | --- |
| Number of participants (n) | |
| Mentees / Mentors | |
| Mean SUS | |
| Median SUS | |
| Standard deviation | |
| Minimum / maximum | |
| Release tag, commit and URL | |

| Task | Attempted | Completed unaided | Completed with help | Not completed | Main difficulty observed | Linked issue |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |

## 10. Data handling

**May go in the repository** (suggested location: `docs/verification/usability-study/`):

- Per-participant SUS responses and scores, by participant code only.
- Task outcomes, error counts, times and difficulty notes, by participant code only, with anything identifying removed.
- Role played and familiarity level.
- The release tag, commit, URL, device and browser for each session.
- The aggregate tables and the checked calculations.

**Never goes in the repository, in GitHub issues or in the report:**

- Names, email addresses, phone numbers, employers or job titles of participants.
- Signed consent forms or recordings of spoken consent.
- Any list that links a participant code to a person.
- Audio, video, screen recordings or photographs of participants.
- Screenshots that show anything a participant typed about themselves.

Keep the private material in one place agreed with the supervisor, readable only by Omar (and the supervisor if required), and destroy it on the agreed date. If a participant withdraws before the cut-off date, delete their sheet and their rows, recompute the aggregates and note in the report that one participant withdrew, without saying who.

## 11. How results feed the report

Update the report only with what was actually observed. If the study does not run, the report keeps its honest statement that usability was not evaluated.

- **Section 5.4.3:** describe the study as run: participants (n, roles, familiarity), release and environment, procedure, task outcomes for every task including unsuccessful and assisted ones, and the SUS mean, median, standard deviation, minimum and maximum.
- **TC-14 in Table 5.4:** replace "not evaluated" with the measured mean SUS, n and the outcome against NFR-03 (met or not met).
- **Section 5.5:** discuss what the findings mean, including mixed findings, the problems observed, which were fixed and retested, and the limits of a small formative sample.
- **Section 6:** state the conclusion against NFR-03 and the related objective without extending it to real mentorship outcomes or to people who were not represented. List follow-up work.

The section numbers above are those of the current report. The older draft in `docs/report-chapter-5.md` discusses SUS under its Section 5.6, so check the numbering against the report before editing.

For each usability problem found, open a GitHub issue with the task number and participant codes (no names), link it from the summary table, and record the fix and any retest. Then update issue 5 and the usability item in issue 122 with links to the evidence.
