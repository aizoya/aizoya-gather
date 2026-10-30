# AIZOYA Gather — submission working draft

Status: NOT SUBMITTED. This draft describes implemented prototype behavior. Live API integration, external publication, and public repository are pending. Remove this status only after verifying those steps.

## Tagline
Different tastes. One great plan.

## Inspiration
Choosing a place with friends often becomes “I don’t know, you pick.” A strong preference can dominate the discussion, while a generic recommendation gives nobody a reason to care. Gather makes the group’s common ground visible.

## What it does
Each of two or three people supplies one favorite artist, film, book, or place and selects the correct entity from search results. The group chooses a place to go, a film to watch, or music to discover. For places, they supply a city.

The tool queries Qloo separately for each person's chosen interest. It compares the returned lists, prioritizes candidates that appear for more people, and then favors the strongest weakest individual rank. Every candidate shows each person's position or an explicit “outside top 12.” A rejected option is excluded from later results. A session shortlist helps the group settle on a choice.

The fictional sample is clearly labeled and exists for exploring the interaction without API access. It is not evidence of live recommendations.

## How it is built
React, TypeScript, Vinext, and Cloudflare Workers. A server-only Qloo adapter calls entity search and Insights; the key never appears in client code. Cloudflare D1 stores three aggregate usage counters, limiting upstream calls across instances. The decision policy is deterministic and inspectable. This version does not use an LLM and should not be described as an autonomous reasoning system.

## Why Qloo matters
Qloo supplies the candidate lists from cultural interests across categories. The local policy compares those lists; it does not invent places or generate substitute recommendations when Qloo fails. Without Qloo, live discovery is unavailable. We have not measured superiority over an LLM-only baseline.

## Challenges and learning
Separate individual taste queries expose compromise more honestly than hiding everyone’s interests inside one combined prompt. A missing result is not proof of dislike. Rankings are not ratings, probability of enjoyment, dietary suitability, current hours, or availability. The interface makes those limitations explicit.

## Current verification
26 automated tests cover ranking, exclusions, empty/partial overlap, validation, provider failures, quota controls, and the server-only request contract. TypeScript/build checks must be recorded for the final submitted commit. Browser sample and missing-key behavior have been checked on the prototype. No live Qloo run has been verified yet.

## Judge testing instructions — finalize after live verification
1. Open the externally published app URL (pending).
2. Choose a specific favorite for Person 1 and select its Qloo result.
3. Do the same for Person 2, selecting the appropriate category.
4. Choose an output type and, for places, a city.
5. Find common ground; inspect the per-person ranks.
6. Reject a result with Try another; verify it stays excluded.
7. Open the decision trace and try the clearly labeled sample separately.

Public source URL: PENDING.
Published demo URL: PENDING.
Live verified commit and timestamp: PENDING.
Open-source license: MIT candidate included in source; confirm before public release.
