# AIZOYA Gather verification record

Date: October 29, 2026 (Pacific)
Runtime source commit: 07d14d2b9024aba59b57e1f5017bb1519e47781d
Hosted version: 2
Audience: owner-private
Published URL: https://aizoya-gather.aizoya-ai.chatgpt.site

## Passed

- 19 automated tests: ranking, exclusions, partial/no overlap, response contract, upstream failure handling, key absence, atomic budget cap/rollover/clock skew, missing database, quota denial, and no upstream call before budget reservation.
- TypeScript no-emit check.
- Production build.
- Local D1 schema migration.
- Browser prototype: fictional sample displayed; rejecting The Lantern Table removed it from subsequent results; missing-key message displayed.
- Hosted authenticated service request, GET /api/gather: HTTP 200, liveConfigured=false.
- Hosted sample request: HTTP 200, mode=sample, 3 picks.
- Hosted live search with no Qloo key: HTTP 503, explicit awaiting-key error.
- Hosted cross-origin sample request: HTTP 403, Origin rejected.
- Private production publication completed successfully through Sites.

Service credentials were supplied only in memory. None are included in this record or source.

## Not verified

- Actual Qloo response shapes, key permissions, search resolution, Insights recommendations, location behavior, real taste overlap, and live replanning.
- Hosted database budget path: no upstream Qloo call was made. Schema generation, local migration, budget unit tests and native deployment passed, but this does not prove runtime D1 reservation on the hosted app.
- Physical iPhone rendering and touch flow. Responsive CSS exists; only the desktop browser was inspected.
- Public anonymous access: deliberately unavailable while owner-private.
- Public GitHub repository and final open-source publication.
- Eligibility acceptance, final Devpost fields, or competition submission.

## Required next evidence

Securely install the Qloo hackathon key. Verify real search → explicit selection → separate per-person Insights → compare → reject/replan. Confirm budget counters change and failed/denied reservations stop upstream calls. Test an iPhone-sized browser and anonymous published app before submitting. Do not present fictional sample outputs as Qloo evidence.
