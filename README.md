# AIZOYA Gather

Gather helps a group turn independent preferences into a shared plan. The current prototype combines OpenAI conversational intake, Tavily web discovery, Qloo cultural taste matching, invitation rooms, private ballots, and agreement reveal. Hosting uses Vinext on Cloudflare Workers with D1.

## Current verification

The deployed source before this documentation update is `5d78117264f5fbf76d62f3bed9500aa609cda4e7`. On October 30, 2026, a fresh hosted synthetic two-person flow completed live OpenAI and Tavily discovery, source-backed October 31 Oakland comedy listings, exact Qloo venue matching, private ballots, and agreement reveal. Both accepted listings were at Quinn’s Lighthouse; their prices remained unknown. A pass removed one listing from agreement. This demonstrates that flow, not broad geographic coverage or guaranteed availability.

The latest implementation passed 82 automated tests, TypeScript checking, and the managed build. These checks do not replace a real two-device mobile review. Public demo access and MIT source publication are approved. Devpost submission is not yet confirmed.

## Main flows

- Start a room, choose a date, city, group size (2–4), and discovery mode; share its link before collecting preferences.
- Each participant confirms private preferences. Event mode accepts natural-language input; Qloo taste modes require selected cultural favorites.
- For new event discovery, OpenAI prepares a bounded query, Tavily retrieves source pages, and candidate validation requires an exact source excerpt containing the event name and requested date. Unknown prices remain unknown.
- Optional Qloo venue checks require source-backed venue/address evidence and an unambiguous entity match. Venue taste ranks describe retrieved venue overlap, not enjoyment probabilities or event availability.
- Participants privately vote Yes, Maybe, or Pass. Agreement appears after all ballots are submitted; a pass excludes that option from agreement.
- Source and booking links appear with recommendations. Apple Maps and Google Maps directions use sourced addresses.

The older individual taste planner also supports exclusions and replanning. After a completed deadlock, the host can open another round in the same room. Preferences persist, ballots reset, and rejected options are excluded. Discovery starts separately under the existing provider allowance.

## Server components

- `lib/gather.mjs`: Qloo entity/tag resolution and per-person recommendation retrieval, bounded concurrency, deadline-aware cancellation, and evidence-based group ranking.
- `lib/grounded-discovery.mjs`: bounded OpenAI intake and candidate extraction with source/date/price validation.
- `lib/tavily.mjs`: basic search and extraction; classified authentication, quota, spending, rate-limit, timeout, network, and provider errors.
- `lib/venue-taste.mjs`: source-backed venue extraction, exact venue resolution, and candidate-filtered Qloo ranking.
- `lib/discovery-invitation.mjs`: short-lived signed shortlist receipts.
- `app/api/rooms/route.ts`: participant credentials, private intake, discovery locks, ballots, and agreement.
- `lib/budget.mjs` and `lib/discovery-budget.mjs`: atomic D1 provider request controls and a conservative test allowance. Reservations can count even when a provider fails.

## Local setup and checks

Use Node 22.13+ and pnpm. Install with `pnpm install --frozen-lockfile`; start with `pnpm dev`.

Configure `OPENAI_API_KEY`, `TAVILY_API_KEY`, and `QLOO_API_KEY` as server-only runtime secrets. Never expose them through NEXT_PUBLIC variables, source, screenshots, or logs. Hosted Qloo configuration does not imply a local Qloo key exists. Apply the append-only D1 migrations through the supported hosting workflow.

Run `node --test tests/*.test.mjs`, `pnpm exec tsc --noEmit`, and `pnpm build`. Managed Sites builds use the supplied Sites build helper. Provider tests should use injected fixtures unless a live call is explicitly intended and within the authorized allowance.

## Privacy and limits

A room link grants room access; participant tokens identify individual seats. Shared state must not expose another participant’s raw preferences or unrevealed ballot. Provider consent explains the relevant data transfer. Qloo receives selected cultural signals and search/location parameters, not participant names or email addresses. OpenAI and Tavily process discovery inputs and queries; precise home addresses should not be placed in prompts.

Room access expires, but records are not automatically purged from D1. Persistent preference learning, payments, booking, verified showtime inventory, comprehensive activity coverage, are not implemented. Budget and distance are not universally verified hard filters. Unknown information must remain visibly unknown. Retrieved listings can change or sell out.

Before public release: verify real-device sharing and privacy, resolve retention/deletion and abuse controls, approve audience changes, and complete the submission requirements against current official rules. Do not describe the prototype as a verified booking or availability service.

## Public demo
https://gather.aizoya.com

OpenAI/Tavily discovery is paused at its bounded test limit. Qloo taste discovery uses a separate quota.
