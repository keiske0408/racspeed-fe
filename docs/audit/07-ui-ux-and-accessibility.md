# 07 — UI/UX and Accessibility

## What's done well

- The public landing page explains the club operations purpose and offers sign-in and membership-request entry points.
- The authenticated sidebar exposes the main operational domains, and the shell includes a mobile navigation drawer with an accessible close label.
- Project Center supports list/board/calendar modes, URL-synchronized filters, labeled search, pressed states, and touch-sized toolbar controls.
- Login/registration provide inline loading/error/success states; registration includes consent and a pending-review confirmation.

## Review method and journeys

The running UI was **not** opened. Findings are based on source inspection; visual spacing, contrast, keyboard behavior, and mobile overflow require browser validation.

1. **Public to membership request:** landing → register → enter name/email/password → consent → submit → pending-review success.
2. **Sign in and continue QR check-in:** login → credential result → validated internal redirect; QR-related continuation is recognized in the page logic.
3. **Authenticated operations:** responsive shell/sidebar → dashboard, members, projects, events, treasury, notifications, and settings.
4. **Project Center:** choose lifecycle/view → search/filter via URL state → open/create activity and continue its detail flow.

## Findings

### Medium — UX-001: Dashboard presents fixed sample figures as current operational data

- **Confidence:** High
- **Location:** `src/app/(app)/dashboard/dashboard-client.tsx:55-68,91,166,370-406`.
- **Evidence:** The monthly chart and recruitment-channel percentages are hard-coded; the displayed total adds a fixed `12`; changing the time-range control does not select different chart data.
- **Impact:** Officers may use illustrative figures as current membership/recruitment results, reducing trust in the dashboard.
- **Recommendation:** Source each metric from a typed server query and make time filters affect the query, or label sample values explicitly as demo data and hide them in production.
- **Plan task:** P2-T01.

### Medium — A11Y-001: Login and registration labels are not associated with inputs

- **Confidence:** High
- **Location:** `src/app/(auth)/login/page.tsx:98-121`; `src/app/(auth)/register/page.tsx:101-143`.
- **Evidence:** Labels have no `htmlFor` and their inputs have no matching `id`.
- **Impact:** Screen readers may not announce field names reliably, and clicking a label will not focus its field.
- **Recommendation:** Add stable IDs and matching `htmlFor`, use `autocomplete` values (`email`, `current-password`, `new-password`, `name`), and add axe/keyboard regression checks.
- **Plan task:** P2-T02.

### Low — UX-002: Dashboard text is globally unselectable

- **Confidence:** High
- **Location:** `src/app/(app)/dashboard/dashboard-client.tsx:94`.
- **Evidence:** The dashboard root applies `select-none`.
- **Impact:** Members cannot easily copy figures or labels for reports and support discussions.
- **Recommendation:** Remove the global rule and apply it only to decorative controls that genuinely need it.
- **Plan task:** P2-T02.

### Needs verification — UX-003: Data-driven loading, empty, and recovery states vary by feature

- **Confidence:** Medium; detailed UI review was sampled.
- **Location:** Feature pages under `src/app/(app)/` and shared components under `src/components/shared/`.
- **Evidence:** Several data domains use independent query/fallback patterns; no complete state inventory was performed.
- **Impact:** Empty database and provider failures may look like sample content or blank screens rather than actionable states.
- **Recommendation:** Define shared loading/empty/error/success patterns and audit one flow per domain using real empty and failure responses.
- **Plan task:** P2-T03.

## Concrete UX direction

- On the dashboard, present sourced metrics with “as of” dates and make unsupported values visibly unavailable rather than plausible sample totals.
- On the projects list, preserve URL-backed filters and add an empty state that explains how to create the first activity.
- In forms, preserve values after failure, show field-level validation, prevent duplicate submissions, and provide recovery actions.
- Run axe and keyboard checks at desktop/mobile breakpoints; visually test focus contrast, touch targets, dialog focus management, and long member names.

## Accessibility coverage limits

No WCAG 2.2 AA conformance claim is made. Automated axe is available as a dependency, but no axe suite was run. Color contrast, zoom/reflow, keyboard-only flows, reduced motion, and screen-reader output need runtime testing.
