# AIZOYA Gather — Devpost submission packet
Prepared October 30, 2026. Status: draft, not submitted.

## Project name
AIZOYA Gather

## Elevator pitch
Different tastes. Shared possibilities. Gather combines Qloo cultural intelligence, live web discovery, and private group voting to help people find their common ground.

## Inspiration
Group planning often ends with “you pick,” an endless message thread, or one person’s preferences winning. We wanted to give each person an independent voice, find options informed by their cultural tastes, and let the group decide without exposing individual ballots.

## What it does
A host creates an invitation for two to four people, with a city and planning date. Participants join separate seats and confirm their preferences privately.

In Qloo taste mode, each participant selects up to three cultural favorites. Gather retrieves individual recommendation lists and compares them across people. Places, movies, and music can be explored across categories. Shared support comes first, followed by the weakest individual rank and mean rank. Missing evidence is shown rather than interpreted as dislike.

For dated event discovery, OpenAI turns the group’s natural-language input into a search request. Tavily retrieves web pages, and Gather accepts event candidates only when the requested date and event name appear together in a source excerpt. Unknown prices remain unknown. If everyone supplies cultural favorites and a sourced venue can be matched unambiguously to Qloo, Gather adds venue taste evidence. That evidence concerns the venue, not the quality or availability of the event.

Participants vote Love it, Maybe, or Pass. The room reveals shared options after everyone submits. A Pass excludes an option from agreement. If no option works, the host can reopen the same invitation: preferences persist, ballots reset, and rejected options stay excluded from later rounds.

Source links, directions in Apple Maps or Google Maps, and a planning calendar export help turn agreement into a next step. Gather does not book or take payment.

## How we built it
React and TypeScript run on Vinext and Cloudflare Workers. Cloudflare D1 stores invitation rooms, participant credential hashes, private inputs, ballots, and atomic request-budget controls.

The server-only Qloo adapter resolves cultural entities and supported tags, then calls Insights separately for individual interests. Retrieval uses bounded concurrency, shared deadlines, deduplication, and deterministic comparison of returned evidence. OpenAI handles bounded conversational intake and structured extraction; Tavily supplies retrieved source pages. Server validation checks date and quote evidence, and signed shortlist receipts prevent client changes to accepted candidates.

We deliberately separate model interpretation from decision rules. Qloo supplies cultural recommendation evidence. The model does not invent Qloo affinities, and individual ballots determine whether a shortlist option is acceptable to the group.

## Challenges we ran into
Taste is different from real-world feasibility. A cultural match does not prove a venue is open, tickets remain, or the total cost fits a budget. We separated those claims and preserve unknown fields.

Provider latency and quotas also matter in a live group flow. We added deadline-aware requests and classified failures so a quota exhaustion is not presented as an unexplained generic error.

Private group input required server-level protection. Other participants’ raw preferences and unrevealed ballots are excluded from room responses. Shared outcomes can still reveal preferences indirectly, which the interface explains.

## Accomplishments we are proud of
We verified a fresh hosted flow through OpenAI, Tavily source retrieval, exact Qloo venue matching, private ballots, and agreement reveal. Two October 31 Oakland comedy listings passed the source checks; both were at the same venue and prices remained unknown.

The implementation passes 82 automated tests, TypeScript checks, and build checks. Integration assertions cover repeated deadlocks, persistent exclusions, provider duplicates, private inputs, and host-only replanning. A separate deployed synthetic test verified same-invitation reset and preserved preferences without provider calls.

These are prototype verification results, not evidence of broad coverage, customer adoption, or superior recommendation quality.

## What we learned
A useful group agent needs cultural grounding and coordination. Separate participant evidence makes compromise inspectable; private ballots make agreement explicit. A model can interpret a request, but it cannot replace source verification or decide what everyone agreed to.

## What's next
Complete real two-device mobile testing, strengthen event identity deduplication, improve geographic coverage and feasibility checks, and add participant-controlled deletion and retention. Explore opt-in preference memory only after the core session experience is reliable.

## Built with
Qloo API; OpenAI API; Tavily; React; TypeScript; Vinext; Cloudflare Workers; Cloudflare D1; Drizzle; CSS.

## Judge walkthrough
1. Open the published demo. PUBLIC ACCESS PENDING APPROVAL.
2. Choose Places, Movies, or Music, enter a city and planning date, and tap Start a room.
3. Copy the invitation into a second browser profile/device. Join the second seat.
4. Each participant selects at least one cultural favorite and confirms privately.
5. On the host seat, select Find options for our group.
6. Inspect Qloo list representation and individual ranks. These are relative rankings, not enjoyment probabilities.
7. Cast a ballot from each seat and view the shared result.
8. To test deadlock recovery, Pass every option from one seat. After reveal, the host opens another round; preferences remain and rejected options are excluded.
9. Optional live event mode uses the separately capped OpenAI/Tavily allowance. Provider limits may prevent another retrieval; do not present cached or synthetic data as a new live search.

## Links and release gates
Demo: https://gather.aizoya.com — deployed, currently OWNER-PRIVATE; not yet an eligible public demo.
Public source: PENDING. Must contain sanitized source, assets, installation instructions and a detectable open-source license.
Latest deployed commit: 34c0eb9afdd7571e6edf434de38619a641de943b.
Deadline: October 30, 2026, 11:45 PM Eastern / 8:45 PM Pacific. Internal target: 8:30 PM Pacific.
Official rules: https://qloo.devpost.com/rules
Official requirements: https://qloo.devpost.com/
Submission page: https://devpost.com/submit-to/31054-qloo-agent-hackathon/manage/submissions

Before final submit: approve public demo and source/license release; inspect sanitized repository; verify anonymous demo and source access; confirm provider allowance supports judge use; capture current clean mobile screenshots; paste fields; verify Devpost confirms submission. No video is required. Registration and submission status have not been verified in the signed-in account.

## Claims to avoid
Do not claim verified availability, booking, guaranteed budgets or distance filtering, automatic personal learning, proven fairness, measured superiority over LLM-only recommendations, or completed real two-device testing. Do not imply Qloo supplies live event schedules. No customers or revenue are claimed.
