# 04 — Performance

## What's done well

- The Project Center supports server-rendered feature pages, URL-backed filters, and media pagination/lazy loading according to the operations guide.
- Notification delivery is queued and claimed in bounded batches rather than performing all provider sends in the request that creates an announcement.
- The app uses `next/font` and a production build step; no unsupported performance rewrite is recommended.

## Findings

### Medium — PERF-001: Task listing is unbounded and loads all task fields

- **Confidence:** High
- **Location:** `src/features/tasks/queries.ts:14-29`.
- **Evidence:** The tasks query selects `*`, filters by club, orders by creation date, and has no page range or limit before mapping every returned row.
- **Impact:** Larger clubs accumulate more rows, increasing response time and memory use; the client may also receive fields it does not need.
- **Recommendation:** Select the fields used by the UI and implement stable cursor/range pagination. Add an index matching the club and ordering columns if absent from the schema.
- **Plan task:** P2-T04.

### Medium — PERF-002: Gemini generation has no explicit request timeout or workload cap

- **Confidence:** High
- **Location:** `src/app/api/broadcasts/generate/route.ts:8-31,70-75`.
- **Evidence:** The handler parses arbitrary JSON and awaits the provider request without an explicit timeout; the endpoint also has no rate cap.
- **Impact:** A large or slow provider request can consume server capacity and delay other work.
- **Recommendation:** Address with the authentication, body-size, rate-limit, and abort-timeout controls in SEC-003; measure route duration and quota after rollout.
- **Plan task:** P0-T05.

### Needs measurement — PERF-003: No production Web Vitals or query measurements were available

- **Confidence:** High that measurements were not part of this audit; runtime impact unknown.
- **Location:** `package.json` dependency/scripts and deployment docs; no telemetry integration was found during the configuration scan.
- **Impact:** The team cannot distinguish user-perceived slowness, expensive Supabase queries, or slow third-party calls by route.
- **Recommendation:** Add privacy-conscious Web Vitals and route/provider duration/error metrics after establishing a baseline. Do not add broad caching until the authorization and invalidation model is clear.
- **Plan task:** P1-T06.

## Measurement plan

1. Collect p50/p95 route latency and Supabase query duration for dashboard, members, tasks, project details, and treasury.
2. Measure LCP, INP, and CLS on public registration and the mobile dashboard using representative data.
3. Test task/media list behavior with realistic multi-year club volumes and a slow network.
4. Track Gemini, Telegram, and email timeouts, retries, and per-club usage without logging member content or credentials.

No mobile-native app assessment applies; the product is a responsive web/PWA.
