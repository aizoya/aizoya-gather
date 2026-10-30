# AIZOYA Gather

A group decision tool for two or three people. Resolve one cultural favorite per person, retrieve separate Qloo taste lists, prioritize shared candidates, and replan when a choice is rejected.

## Status

Prototype built October 29, 2026 for the Qloo Agentic Hackathon. Qloo API access has been requested; **no live Qloo calls have been verified**. Fictional sample mode demonstrates the workflow and is explicitly labeled. This is not yet a qualifying live submission. No customers, revenue, or performance superiority are claimed.

## Run

Node 22.13+ and pnpm. `pnpm install --frozen-lockfile`, then `pnpm dev`. The Sites starter uses Vinext and Cloudflare Workers. Configure `QLOO_API_KEY` as a server runtime secret, using local `.dev.vars` for Wrangler or the hosting provider's secret management. Never prefix it with NEXT_PUBLIC or put it in source. See `.env.example` for the variable name. The browser never receives the key.

Checks: `node --test tests/*.test.mjs`; `pnpm exec tsc --noEmit`; `node /root/.codex/plugins/cache/openai-curated-remote/sites/1.1.2/scripts/build-site.mjs` in the managed Sites environment. Portable build: `pnpm build`.

## Architecture

- `app/page.tsx`: intake, explicit entity disambiguation, result comparison, shortlist, rejection and trace.
- `app/api/gather/route.ts`: same-origin bounded JSON interface; no raw upstream error or key disclosure.
- `lib/gather.mjs`: injected-fetch API adapter, validation, deterministic ranking, fictional fixture.
- `tests/gather.test.mjs`: policy and adapter tests with fictional upstream fixtures.

Qloo calls: `GET https://hackathon.api.qloo.com/search` with `query`, `types=urn:entity:<type>`, `take=5`; `GET /v2/insights` with `filter.type`, a single `signal.interests.entities` per person, optional `filter.location.query` for places, `filter.exclude.entities`, and `take=12`, then at most one `take=24` recovery pass if no option appears for everyone. Header: `X-Api-Key`. Documented interface must still be confirmed against the actual granted key. See https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide and https://github.com/qloo/docs-public.

## Decision policy

A bounded tool workflow: resolve → ask the person to select the entity → retrieve each taste list → compare → rank → display evidence → exclude on rejection and rerun. No LLM is required by this version. Do not claim autonomous reasoning or LLM capabilities.

Candidates are ordered by number of people whose retrieved list contains the candidate (12 initially, up to 24 after one recovery pass), then worst rank (missing = 1000), then mean rank, then entity ID for deterministic ties. This favors broad representation; it is a product policy, not a measured fairness guarantee. Rank positions are not satisfaction probabilities. An absent result means outside the retrieved list, not dislike. Returned ranks depend on Qloo ordering. No invented venue hours, dietary assurances, prices, travel times, or availability. Shortlists live only in React session memory.

## Before public release / submission

1. Install the actual key securely and resolve real entities end-to-end.
2. Confirm `/search` and `/v2/insights` shapes and location parameter behavior against official docs and live responses; adapt without committing response data.
3. Test real shared/partial/no-result/error cases and three-person replanning.
4. Verify the D1 migration and shared request budget on the hosted environment. The adapter now reserves an atomic global budget before every upstream request: 3/second, 60/minute, and 1,000/UTC day. Missing or failed D1 access prevents the call. Counters store no visitor data. A denied reservation changes no counters. A successfully reserved call still counts if the provider fails; no refund is attempted. Second-window collisions wait at most twice, while minute/day exhaustion returns a limit error. Limits are fixed windows, not a complete anti-abuse service, and must fit the actual key quota. Same-origin checks alone are not abuse protection.
5. Approve external publication and open-source license, create a public repository, publish a working demo, and test it anonymously on phone and desktop.
6. Complete Devpost text/screenshots using only verified behavior. No demo video is required according to the reviewed overview.

## Data

Only chosen taste IDs, a city, and exclusions are sent to Qloo. Person labels are generated locally (Person 1, etc.). No account or analytics is implemented in the app. Hosting may apply its own access boundary and logging. No raw Qloo data is stored in this repository. Fictional sample fixtures are invented. API keys and local environment files are ignored by Git.

## Request budget

`lib/budget.mjs` reserves all three windows atomically in a single SQLite UPSERT on one `api_budget_gate` row. Reservations rejected by any window change no counters. The older three-row table remains for migration history but is no longer used. A second-window collision can wait at most twice before returning an error; daily/minute exhaustion does not retry. Quota errors remain actionable HTTP 429 responses. No upstream provider retries are performed. Fixed windows are conservative demo controls, not a complete anti-abuse service. The limit must be checked against the actual key entitlement. `drizzle/0001_lonely_puma.sql` adds the new gate; do not rewrite applied migrations. No Qloo response data, user identifiers, or tastes are stored in D1.

A plan receives a shared 25-second cancellation signal for upstream calls. Database latency and bounded pacing can add overhead; this is not a hard wall-clock completion guarantee. If top-12 lists contain candidates but no shared option, the policy widens once to top 24 without changing interests, geography, or exclusions. The trace shows the recovery decision. Empty lists do not trigger another pass. Partial results remain labeled partial. All recovery behavior is verified with fictional test data, not yet with live Qloo responses.
