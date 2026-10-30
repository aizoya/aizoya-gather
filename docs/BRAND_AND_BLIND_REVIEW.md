# AIZOYA Gather — brand and independent AI review

Date: October 29, 2026. Status: working candidate; no live Qloo evidence yet.

## Blind review method

The founder requested blind feedback on what could be built with Qloo in under 24 hours. Two independent AI reviewers received the official hackathon URL, deadline, build constraints, and unverified API-access status. Neither received Gather's name, concept, source, screenshots, or the other reviewer's recommendations during the blind phase. These are independent AI opinions, not human expert or competition-judge validation. After their initial responses were returned, both received Gather's design for a second, explicitly non-blind assessment.

## Independent proposals

Product reviewer:
1. Bridge Night — mediate a fair movie choice between people with different tastes.
2. Shelf Signal — help booksellers select a discovery table from cultural audience interests.
3. New Roots — find culturally relevant footholds in a new city.

Technical reviewer:
1. Counter Clerk — recommend only books in a shop's declared inventory, using Qloo to rank a finite catalog.
2. Radio Bridge — discover an artist connecting two different artist audiences; no audio-mixing claim.
3. Pop-up Placement Scout — shortlist culturally relevant places to research for hosting a creator's pop-up; no availability or outreach claim.

## Product assessment after reveal

Stay with Gather, narrow to two-person movie mediation for the judging demonstration. Reason: bookstore scope needs inventory ingestion and fresh entity-coverage evidence. A pivot before proving API access adds risk. This is a recommendation, not a change to the product's currently supported categories.

Priority suggestions: demonstrate real resolve/query/veto/replan; show each input's own top choice beside compromises; describe retrieval overlap rather than satisfaction; explicitly expose missing overlap and a controlled recovery step. No LLM is expressly required by the rules, but whether a deterministic recommender loop is convincingly agentic remains a judging risk. Adding decorative LLM prose does not resolve that risk.

## Qloo technology and kit

Qloo supplies cultural entities and aggregate taste affinities across categories. It is not evidence of an individual's psychology or future behavior. The app's compromise policy belongs to Gather; Qloo does not certify that policy as fair. Sites supplies the app UI, server hosting, and database. It does not create Qloo's cultural graph.

Founder-provided Qloo email: key turnaround usually one business day; personal key must stay on machine/server; no names, emails, or device IDs sent to Qloo; event supports qloo exec and qloo mcp, not harness chat/plan/build. The official kit README additionally describes optional exploration routes; use the event-specific email's supported-mode limits. Direct API tooling is allowed by the event; no harness dependency has been added to this Worker app.

Official kit: https://github.com/qloo/qloo-hackathon-kit
Submission guide: https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SUBMISSION.md
Event: https://qloo.devpost.com/

## Applied brand sources

Canonical palette recovered directly from aizoya/AIZOYA app/globals.css, blob 2a26773a75060f81f3c4c46b894463ae43cc1524:
- Navy #071C45
- Deep navy #102B56
- Electric blue #087CF0
- Cyan #0BA5F5
- Gold #D7B06A
- White #FFFFFF
- Cool gray #64748B

Brand lockup follows docs/brand/AIZOYA_MASTER_BRAND_STANDARD.md, blob 2fd0af3cf63422b3fb401eb1c167ff6158a3e3f1: transparent Circle A left, official wordmark right, product name separate. No recreated Circle A or typed replacement wordmark.

Original transparent master recovered from Library aizoya-master-logo.png, libfile_15221e378e548191b154e5fd6eaf70ac. Copied without image modification to public/aizoya-master-logo.png. RGBA 1254x1254; SHA-256 693c6e2d1a074f229dbf599c2947d42a3a8c66fb81f5223f33ed37f901002d91.
Official wordmark recovered unchanged from public/aizoya-wordmark.svg in canonical repo, blob 4df52b0104056df589b4964ea067c5fe6b63a5db.
An older PNG from the historical orbital branch failed image decoding and was not used. The legacy JPEG has a white background and was not used.

Colors are applied in the prototype; browser review confirms the original master lockup appears in the top-left on navy. This is product-specific styling using canonical tokens, not a new company brand system.

## Technical assessment after source reveal

Verdict: MODIFY candidate; HOLD submission-readiness until live testing. Both reviewers ultimately advise staying with Gather because its critical path is shorter, not simply because code exists. Product reviewer favors movie mediation; technical reviewer favors verifying the existing place flow. No category pivot has been applied pending live evidence.

Source findings and disposition:
- P0: actual Qloo key, schema, useful results and deployed reject/replan remain unverified. OPEN.
- P1: 3/second global limiter can reject a normal fast session after search plus a three-person plan. Sequential calls do not guarantee spacing. Add bounded pacing after quota is verified. OPEN.
- P1: denied second-window reservations still consume minute/day counts. This is conservative budget behavior, disclosed in README; no atomic all-window refactor is claimed. OPEN.
- P1: top-12 retrieval can miss compromise candidates below rank 12. Add bounded no-overlap recovery, and expose the choice in trace. OPEN.
- P1: no LLM/framework/autonomous tool selection exists. Describe a bounded decision tool, not an autonomous agent. Interpretation of the event's agentic-tool criterion remains uncertain. OPEN.
- P2: an overall planning deadline, live ID/type validation and a copyable final summary would improve reliability/usefulness. OPEN.
- Overstrong “No one’s taste quietly takes over” wording removed; result text now names Gather's own compromise rule. APPLIED.

These findings are independent source-review opinions and properties of the inspected code, not live production incidents or external human certification.

## Reliability follow-up

The private candidate now addresses the limiter and recovery findings. A new append-only migration, 0001_lonely_puma.sql, adds a single-row api_budget_gate. All three window limits are checked by the same UPSERT before counters change. Burst contention can wait at most twice; minute/day exhaustion returns an actionable limit response. The adapter preserves GatherError status.

The decision workflow first compares top-12 results. If candidates exist but no option is shared by all inputs, it widens once to 24 while keeping interests, location, and vetoes unchanged. The UI reports the actual retrieval depth. A shared upstream deadline produces an explicit 504 timeout, including when a call is already in flight.

26 automated tests pass, including SQL denial accounting, clock skew, bounded waiting, abort behavior, one-pass recovery, empty/disjoint results, and in-flight planning timeout. The new schema migration succeeded locally. The independent technical reviewer returned GO for a private candidate update conditional on successful build and target migration; live Qloo integration and competition-readiness remain HOLD.

Recovery deliberately fails the plan if the wider query fails, instead of silently displaying partial initial results as a successful recovery. That conservative behavior remains a product limitation. These tests do not prove the live provider's schemas, coverage, key permissions, quotas, or hosted database behavior.
