---
name: printpro-data-architecture
description: Encodes PrintPro's data isolation, Supabase RLS, and sync-reliability rules. Use whenever writing, reviewing, or modifying any code that reads/writes user data, touches localStorage caching, calls syncEntityToCloud, adds a new Supabase table/query, or changes auth/session handling. Also use when adding any new page, feature, or field that displays data, to confirm it is never hardcoded and always properly scoped to the authenticated user.
---

# PrintPro Data Architecture & Sync Rules

This skill documents the non-negotiable data-handling rules for this codebase, established
after fixing a cross-user data leak and a sync-reliability bug. Any new code — features, bug
fixes, refactors — must follow these rules. Do not deviate from them even if it looks like a
shortcut would work for a specific case.

## Source of truth

- **Supabase (Postgres) is the single source of truth for all data.** localStorage is only a
  local read cache and an offline-optimistic-write buffer. It is never authoritative.
- Any time local state and Supabase state disagree, Supabase wins. Code must be written to
  reconcile toward Supabase, never to trust the local cache over a confirmed Supabase response.

## Rule 1 — Per-user data isolation (security-critical)

- Every Supabase table containing user-scoped data **must** have a Row Level Security (RLS)
  policy that filters by the authenticated user's ID/org at the database level. Frontend
  filtering (e.g. `.eq('user_id', currentUser.id)` in a query) is a defense-in-depth measure,
  never the primary control — assume the frontend filter could be missing or wrong, and that
  RLS is the actual security boundary.
- Before adding a new table or RPC, check: does it have an RLS policy scoping it to the
  authenticated user? If not, add one before writing any code that queries it.
- Any local cache (localStorage) key that stores user data must be scoped per user ID —
  never a single shared key across all users (e.g. use `printpro-state:{userId}`, not
  `printpro-state`).
- On logout: fully clear the local cache for the previous user. On login: populate the cache
  fresh from Supabase before rendering any user-scoped page — never render stale/previous-user
  cached data while the new fetch is in flight.
- When reviewing any auth-related change, explicitly check for this race condition: a new
  user's session becomes active before the previous user's cached data has been cleared.

## Rule 2 — Sync must reflect real Supabase state, not just local writes

- Every write path (create/update/delete on `bills`, `bill_items`, `payments`, `customers`,
  `inventory_items`, `purchases`, `business_profile`, and any future table) must go through an
  explicit sync-status state machine, not an implicit "assume success" write:

  `pending → syncing → synced` (success path)
  `pending → syncing → failed → retryable` (failure path)

- The UI must only show "saved" once Supabase has actually confirmed the write — never based
  on the local optimistic write alone.
- The UI must only show "failed" when Supabase has actually returned an error — a slow-but-
  still-in-flight request is "syncing," not "failed." Do not conflate latency with failure.
- Failed writes must be retryable and recoverable, never silently dropped. If you add a new
  write path, it must plug into the same retry/queue mechanism — don't write a one-off
  fire-and-forget call.
- Rapid successive writes to the same record must not silently overwrite each other before
  reaching Supabase — check for and prevent this class of race condition in any new write flow.

## Rule 3 — Same user, multiple devices is expected and must reconcile correctly

- A user may be legitimately logged in on more than one device at once (e.g. desktop + mobile,
  owner + staff). This is normal usage, not a security issue — do not restrict it.
- When one device writes data, other active sessions for the same user should reflect that
  change within a reasonable time. Prefer Supabase Realtime subscriptions where practical;
  fall back to refetch-on-focus/refetch-on-interval if realtime isn't wired up for that table.
- Near-simultaneous writes from two devices for the same user must both persist correctly (or
  fail explicitly with a clear conflict/retry path) — never silently let one overwrite the
  other without the state machine surfacing what happened.
- This shares the same underlying mechanism as Rule 2 — build multi-device reconciliation and
  sync-status handling together, not as separate systems.

## Rule 4 — No hardcoded or placeholder data, anywhere

- Every value rendered in the UI must originate from a real Supabase query/RPC, or from
  properly user-scoped local cache backed by Supabase — never a static array, fixture, or
  mock standing in for real data, even temporarily during development.
- Note: `advance_payments`, `expenses`, `promo_codes`, `recurring_bills`, `group_bills`, and
  `notifications` currently live in `localStorage` / the `business_profile` JSONB column
  rather than dedicated tables. Treat this as real, user-scoped data subject to Rules 1–3 —
  not as an exception that permits hardcoding.
- If a new feature needs sample/seed data for local development, keep it clearly isolated in a
  seed script or dev-only fixture file, never inline in application code paths that ship to
  users.

## Rule 5 — Respect the mobile/desktop split

- All `/mobile/*` routes and the `ViewportBanner` component are a separate, finished UI and
  are out of scope for desktop work. Do not modify, refactor, or reference them when working
  on desktop pages, and vice versa.
- Shared logic (Supabase queries, sync state machine, RLS-dependent code) should live in
  shared, non-UI modules that both desktop and mobile can use — but any UI-layer change should
  stay within its own surface (desktop vs. mobile).

## When writing or reviewing code, check for these red flags

- A Supabase query without a corresponding RLS policy on that table.
- A `localStorage` key that isn't namespaced by user ID.
- A write path that marks something "saved" before an `await` on the Supabase call resolves.
- A `catch` block that swallows a sync error instead of transitioning to a `failed` /
  retryable state.
- Any static array, object, or fixture used to populate a real UI page instead of a live query.
- New code inside `/mobile/*` while working a desktop task, or vice versa.
- A new table or write path that isn't wired into the shared sync-status state machine.

## Verifying a fix or new feature against this skill

Before considering data-layer work complete, confirm:

1. Two different authenticated users cannot see each other's data (check RLS directly in
   Supabase, not just in the app UI).
2. Rapid data entry produces an accurate sync status at every step — no false "failed," no
   silently dropped writes.
3. The same user on two devices sees each other's writes within a reasonable time, without
   overwrite or data loss.
4. No page renders a hardcoded/mock value in place of live data.
5. `/mobile/*` and `ViewportBanner` are unchanged if the task was desktop-scoped (or vice
   versa).
