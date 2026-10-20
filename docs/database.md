# Database Architecture & RLS Documentation

## Schema Layout
The database is structured into two PostgreSQL schemas:
1. `public`: Relational entity tables exposed through the Supabase Data API, protected by mandatory Row Level Security.
2. `private`: Non-exposed helper schema containing security-definer authorization functions.

### Entity Relationships
- **Clubs & Multitenancy**: `clubs`, `club_memberships`, `membership_roles`. Each operational record belongs to a primary host club (`club_id`). Joint events and projects link secondary partner clubs through join tables (`event_clubs`, `project_clubs`) without mixing rosters or ledgers.
- **Privacy & Consent**: `member_private_details` stores restricted personal and health data (birthdate, emergency contact, blood type) under Philippine Data Privacy Act principles. Access requires `MEMBER_SENSITIVE_VIEW`.
- **Accounting Math**: Monies are stored as PostgreSQL `numeric(12,2)` and handled as integer centavos in TypeScript. Editable balances are forbidden; member balances are dynamically computed from active invoice items, verified allocations, and adjustments.
- **Anti-Duplicate Constraints**:
  - `unique (event_id, profile_id)` on `attendance_records` strictly blocks multiple check-ins for the same event.
  - `dedupe_key` on `invoices` prevents duplicate scheduled dues runs.
  - `run_key` on `scheduled_job_runs` guarantees idempotent cron execution.

### RLS Authorization Model
Helper functions:
- `private.is_platform_admin()`: Confirms active platform administrator status.
- `private.is_active_member(club_id)`: Checks membership in a specific club.
- `private.has_permission(club_id, perm_key)`: Traverses `club_memberships -> membership_roles -> role_permissions -> permissions` to verify scoped privileges.
