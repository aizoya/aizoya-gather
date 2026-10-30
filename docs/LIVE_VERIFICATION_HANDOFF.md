# Gather live verification and submission handoff

Status: BLOCKED on issued Qloo credentials and successful live verification. Automated tests do not prove provider compatibility.

## Verified preparation

- Custom domain gather.aizoya.com and its HTTPS certificate reported active by Sites.
- Source imported to private GitHub repository aizoya/aizoya-gather, branch build/submission-source.
- Import commit c8a15da25ed04783bc6ee081ff471f02ce5bbe23 has tree 6d768ffc9d9eae86b255db68f77934819a371239, identical to Sites source commit 79ad11388282320e39685d785539bbfebb093b2f.
- All 26 dependency-free tests passed again after source recovery on October 29, 2026 Pacific. TypeScript/build passed before recovery; not rerun during transfer.
- Devpost draft exists; no final submission acknowledgment.

## Key installation

Install the personal Qloo key only as the server runtime secret QLOO_API_KEY. Do not commit it, paste it into client code, include it in screenshots, or add it to this document. The adapter uses https://hackathon.api.qloo.com with X-Api-Key. Confirm actual account quotas before claiming the configured ceilings match the key's entitlement.

## Live acceptance sequence

1. Confirm GET /api/gather reports liveConfigured true. This proves configuration presence only.
2. Search for one recognizable movie and one artist through the actual UI. Select unambiguous returned entities; record their types and IDs privately for reproduction, without recording credentials.
3. Choose movie output and run a two-person plan. Verify actual /search and /v2/insights response shapes match the adapter and useful entities render.
4. Inspect per-person ranks, retrieval depth, missing-overlap wording, and trace. Do not infer enjoyment probability from a rank.
5. Reject one displayed entity and rerun. Confirm the excluded ID is absent from all displayed picks and from subsequent results for that session.
6. Exercise a real no-overlap case if available: one expansion from 12 to 24, unchanged inputs/location/vetoes, then a clear partial or empty result. Do not claim a real recovery test if no suitable case occurs.
7. Verify sample mode remains explicitly fictional, and provider failures never produce sample success.
8. Check the hosted database budget path, quota errors, and a phone-width browser interaction. Record tested device/browser and limitations accurately.
9. Record exact tested deployment/source commit, time, statuses, and pass/fail evidence. Avoid publishing raw Qloo responses until their publication rights are established.

## Release and submission

- Review the MIT source license and rights to all included assets before making the repository public. Company branding remains company branding; do not assume a code license grants trademark rights.
- Obtain any remaining authorization for public release. Merge/release the reviewed snapshot and verify public source and demo access while signed out.
- Update Devpost story to reflect actual verified behavior and the final test count. Keep deterministic-tool positioning accurate; no LLM is implemented.
- Complete additional information: project began October 29, 2026; final public demo URL; final public licensed source URL.
- Add an honest screenshot/thumbnail of the final app. No video requirement was found in the reviewed event requirements.
- Submit before the verified October 30, 2026, 8:45 PM Pacific deadline and verify the final acknowledgment. A saved draft is not a submission.

Do not mark complete while the key, live results, public access, or final acknowledgment remains unverified.
