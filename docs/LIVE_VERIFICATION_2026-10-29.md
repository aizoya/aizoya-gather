# Hosted Qloo verification

Verified October 29, 2026 Pacific against private https://gather.aizoya.com; Sites version 6, source 3a9c939eb600a52153a0c1e16096de900bfde9ee. No key or raw provider response is stored here.

Root cause: redirect:error is unsupported in Cloudflare Workers. Changed to manual; non-2xx responses still fail closed without following redirects or forwarding the key.

27 tests, TypeScript noEmit, and build passed. Private deployment succeeded with runtime secret revision 1.

Hosted checks: configuration true; movie searches for Inception and Spirited Away each returned HTTP 200 and five entities. Two-person movie plan returned HTTP 200 in 1096 ms of app-measured time. No shared candidate in the top 12 triggered exactly one expansion to 24; the result remained correctly labeled shared:false. The initial four Insights calls succeeded, exercising the hosted budget path and recovery. Rejection/replan returned HTTP 200, three picks, and excluded the rejected ID.

Limits: authenticated API checks, not physical iPhone/browser end-to-end QA. This case did not prove full group overlap. Public access, public source release, screenshot media, updated final Devpost facts, and submission acknowledgment remain pending.
