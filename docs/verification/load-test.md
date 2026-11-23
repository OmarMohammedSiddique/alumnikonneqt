# Load test of the matching endpoint

Evidence for issue 29 and for NFR-01 in the report: at least 95% of matching responses within 2 seconds at 100 concurrent requests. This file records measured runs only. A run that misses the target is recorded as a miss.

## How to run

```bash
node --env-file=.env.local scripts/load-test-match.mjs 25 100 5 docs/verification/load-test/samples.json
```

The arguments are the number of disposable accounts, the number of simultaneous requests in a round, the number of rounds, and an optional file that receives one record per request (round, status, milliseconds, matches returned, error name) so the summary can be recomputed. Round 0 in that file is the warm-up. Set `LOAD_TEST_APP_URL` if the application is not on port 3000. The script accepts local targets only. It creates fictional Mentee accounts, gives each an embedding through `POST /api/embed`, makes one warm-up request per account, sends the rounds and deletes the accounts, including when it is interrupted. Failed requests are counted and stay in the percentiles, and a response without a list of matches counts as failed. Every account has the same profile text, and with 25 accounts each one carries four of the 100 simultaneous requests.

## Run 1: local baseline, 23 November 2026

| Item | Value |
| --- | --- |
| Code | Production build of main served with `next start`. The checkout was fast-forwarded from `c231095` to `a29f349` while the build ran, so the exact commit is uncertain; the tested routes are identical in both |
| Machine | Apple silicon laptop, which also ran the load generator |
| Database | Development Supabase stack on the shared Azure VM, reached through an SSH tunnel |
| Catalogue | 5 Mentors with embeddings |
| Accounts | 25 disposable fictional Mentees, deleted afterwards |
| Workload | 5 rounds of 100 simultaneous `POST /api/match` requests, 500 in total |

| Measure | Result |
| --- | --- |
| Responses with status 200 | 500 of 500 |
| Within 2 seconds | 5 of 500 (1%) |
| Minimum | 574 ms |
| Median | 4,474 ms |
| 90th percentile | 5,033 ms |
| 95th percentile | 5,108 ms |
| 99th percentile | 5,178 ms |
| Maximum | 5,404 ms |
| One request at a time (warm-up) | median 531 ms, maximum 712 ms |

Summary output: [load-test/local-2026-11-23.txt](load-test/local-2026-11-23.txt). This run was made before the script saved per-request samples, so its percentiles cannot be recomputed.

**Verdict for this setup: NFR-01 not met.**

## Run 2: local baseline with samples, 24 November 2026

Same machine, database, catalogue and workload as run 1, on a fresh production build of main at `a29f349`, Node 26.13.0.

| Measure | Result |
| --- | --- |
| Responses with status 200 and a list of matches | 500 of 500 (5 matches each) |
| Within 2 seconds | 7 of 500 (1.4%) |
| Minimum | 564 ms |
| Median | 4,548 ms |
| 90th percentile | 4,787 ms |
| 95th percentile | 4,819 ms |
| 99th percentile | 4,917 ms |
| Maximum | 5,102 ms |
| One request at a time (warm-up) | median 540 ms, maximum 745 ms |

Summary: [load-test/local-2026-11-24.txt](load-test/local-2026-11-24.txt). Per-request samples: [load-test/local-2026-11-24-samples.json](load-test/local-2026-11-24-samples.json). The figures above were recomputed from the samples with a separate script and agree with the summary.

**Verdict for this setup: NFR-01 not met.**

## What these runs do and do not show

- Every request was answered correctly under 100 simultaneous requests. Nothing failed or timed out.
- The two runs agree: about 1% within 2 seconds and a 95th percentile near 5 seconds.
- The response time under load was more than twice the target. A single request already took about half a second, because each one makes three database round trips across the SSH tunnel (session check, own embedding, `match_mentors`).
- The load generator, the application server and the tunnel shared one laptop, so they competed for the same processor and connection.
- This is not a measurement of the hosted system. Hosted performance remains not evaluated until a run against a hosted deployment is recorded here.
- Five Mentors is far too small a catalogue to say anything about retrieval time at a realistic size.

## Still to do

- Confirm that giving the disposable accounts an embedding sends no email. `POST /api/embed` starts the notification worker, the addresses end in `example.test`, and the accounts are deleted within minutes, but the local mail catcher was not inspected.
- A bounded run against a hosted preview deployment with fictional accounts.
- A run with a larger seeded catalogue.
- Separate timings for the database call, the embedding step and the whole request, as issue 29 asks.
