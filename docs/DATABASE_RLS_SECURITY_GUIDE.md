# Database RLS and Privilege Escalation: The UI Is Not the Security Boundary

**The mistake in one sentence:** the app hides the admin panel from non-admins in the UI, but the database itself will still let any logged-in user write `is_admin = true` on their own row — because nobody locked that column down at the data layer.

---

## What it looks like

A course-portal-style app has an account settings page where users update their own name and email preferences. It uses Supabase (or any Postgres-with-row-level-security setup) with the anon/public key on the client, protected by a row-level security (RLS) policy that says "you can update your own row":

```sql
-- The policy that ships by default in a lot of scaffolded projects
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
-- Looks safe: users can only touch the row that matches their own ID.
```

The problem: this policy restricts *which row* you can update, but says nothing about *which columns*. If `profiles.is_admin` (or `role`, or `stripe_customer_id`, or any other sensitive column) lives on that same table, any authenticated user can do this from their browser console, using nothing but the public anon key:

```javascript
// Runs from any logged-in user's browser — no special access needed
await supabase.from('profiles').update({ is_admin: true }).eq('id', myOwnUserId);
```

That succeeds. The row-level check passes (`auth.uid() = id` — it's their own row). Nothing checks *which columns* were in the `UPDATE`. The user is now an admin, and every admin-gated RLS policy on every other table now opens up to them too, because those policies typically just check `is_admin = true` on this same table.

Meanwhile, the app's `<AdminRoute>` React component — which hides the admin nav link and redirects non-admins away from `/admin` — worked perfectly the whole time. It just never mattered, because it isn't the actual security boundary.

## Why AI tools generate this

Client-side route guards are the easy, obvious thing to build when you ask an AI assistant to "make sure only admins see the admin page" — and they're not wrong to exist, they're just not sufficient on their own, and this distinction rarely gets surfaced unless you specifically ask for it. A model asked to "protect the admin route" will confidently produce a `<ProtectedRoute requireAdmin>` wrapper and consider the job done, because from a pure UX standpoint, it is.

The database side compounds this in a specific, subtle way with row-level security systems (Supabase, and RLS in Postgres generally): **RLS policies are row-scoped by default, not column-scoped.** Writing `USING (auth.uid() = id)` is the natural, correct-looking thing to generate for "let users edit their own profile" — and it *is* correct, for the columns that are supposed to be self-editable (name, avatar, preferences). It's silently wrong the moment a privileged column (`is_admin`, `role`, `credit_balance`, `stripe_customer_id`) sits on the same table, because nothing in that one-line policy distinguishes "the fields a user should be able to change about themselves" from "the fields that determine their privileges." An AI assistant generating the policy from "users should be able to update their profile" has no reason to reach for the more advanced, less commonly-known column-level `GRANT`/`REVOKE` syntax needed to close this gap — it isn't part of the "make the feature work" prompt.

There's also a version-control blind spot: RLS policies are frequently authored directly in a cloud dashboard (Supabase Studio, etc.) rather than as migration files in the repo, because it's the fastest way to get something working. That means the actual security rules governing your database often exist *nowhere in your codebase* — not in what you'd hand an AI assistant to review, and not in what a human reviewer would read in a pull request.

## Why it's dangerous

- **Full privilege escalation from a standard account.** Any user who signs up gets a path to becoming an admin — no exploit needed beyond knowing SQL/the client library, which is trivial to find in browser dev tools or by asking an AI assistant "how do I update my Supabase profile."
- **It cascades.** Once `is_admin` is `true`, every other RLS policy gated on that same flag opens up too — inventory, other users' data, billing details, audit logs. One missing column restriction becomes total compromise.
- **The client-side guard gives false confidence.** Because the UI correctly hides admin features from non-admins, manual QA and casual code review both look clean. The gap only shows up if someone specifically tries to write to the database directly, bypassing the UI.
- **It's invisible in the repo.** If the vulnerable policy lives only in a cloud dashboard, `grep`-based review, static analysis, and AI code review of the checked-in code will all miss it — there's nothing in the repo to look at.

## How to check your own app

If you're on Supabase or another RLS-backed Postgres setup:

```sql
-- 1. List every UPDATE policy on every table, and read what it actually restricts
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE cmd = 'UPDATE'
ORDER BY tablename;

-- 2. Specifically check column-level grants on any table with a privilege
--    or role column — does `authenticated` have UPDATE on that column?
SELECT table_name, column_name, privilege_type, grantee
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND column_name IN ('is_admin', 'role', 'is_staff', 'tier', 'credit_balance')
  AND grantee IN ('authenticated', 'anon');
-- If `authenticated` shows UPDATE on any of these, that's the bug.
```

```bash
# 3. Confirm your repo actually has these policies checked in as SQL files —
#    if grep finds nothing, your real security rules exist only in a dashboard
grep -rl "CREATE POLICY" --include="*.sql" .
# If this is empty or thin relative to your table count, export your live
# policies (`supabase db dump` or equivalent) and commit them.

# 4. Grep your own client code for any place a "privileged" column is sent in
#    an update payload from client-side code — even if the column SHOULD be
#    locked down, this tells you where the risk is highest
grep -rn "is_admin\|role:\|is_staff" --include="*.tsx" --include="*.ts" src/ client/src/
```

For any auth system with a second factor (email OTP, TOTP, SMS) sitting in front of sensitive data: check whether that second factor is enforced *only* by your frontend/middleware, or whether it's actually encoded into the session/token the database checks. If your API and your database would both accept a password-only session with no evidence the second factor was ever completed, the second factor is UX, not security.

## The fix

**Treat RLS (or your equivalent server-side authorization layer) as the actual security boundary, and treat the UI guard as a nice-to-have for user experience only.** Concretely:

1. **Lock down privileged columns separately from the row-level policy.** Revoke broad `UPDATE` and re-grant only the columns a user should be able to self-edit:

```sql
-- Revoke blanket UPDATE, then grant back only the safe, self-editable columns
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, email_preferences) ON profiles TO authenticated;

-- is_admin, role, stripe_customer_id, credit_balance etc. now require the
-- service-role key (server-side only) to change — exactly what you want.
```

2. **Split privileged fields into a separate table if column-level grants get unwieldy.** A dedicated `user_roles` table that only your backend's service-role key can write to is often simpler to reason about than fine-grained column grants on a wide `profiles` table.

3. **Version-control every policy.** Export live policies to a SQL file in your repo (`supabase db dump --schema public > docs/rls-policies.sql`, or your platform's equivalent) and keep it current. Treat undocumented dashboard-only policies as a standing security debt item until they're captured.

4. **Enforce a second factor at the data layer, not just the UI/middleware layer**, if you have one. If your platform supports encoding assurance level into the session token (e.g. Supabase's AAL/MFA), require the elevated level in both your API middleware *and* your RLS policies — not just a redirect in your frontend router.

```sql
-- Example: require a second-factor-verified session for sensitive reads,
-- enforced at the RLS layer, not just checked by a page redirect
CREATE POLICY "Staff can read cases, second factor required"
ON cases FOR SELECT
USING (
  is_staff(auth.uid())
  AND (auth.jwt() ->> 'aal') = 'aal2'
);
```

## Checklist

- [ ] Every table with a privileged/role/tier column has that column locked down with explicit `REVOKE`/`GRANT`, separate from the row-level `USING` policy.
- [ ] All RLS policies (or equivalent server-side access rules) are exported and version-controlled in the repo, not left dashboard-only.
- [ ] Client-side route guards are documented as UX-only, with a comment pointing at the real enforcement layer, so nobody mistakes them for security.
- [ ] If you have a second factor (OTP/MFA), it's checked at the API and/or database layer using session-encoded assurance level — not only by a frontend redirect.
- [ ] You've run the column-privilege query above against every table that has a privilege/role/tier/balance column.
- [ ] New tables get an explicit "who can write which columns" review before shipping, not an assumed-safe default.

## Prompt your AI assistant

```
Audit this repository's database access-control layer for privilege
escalation via unrestricted column writes.

If this project uses Supabase or another RLS-backed Postgres setup:

1. List every table that has a privilege/role/tier/balance-style column
   (e.g. is_admin, role, is_staff, tier, credit_balance, stripe_customer_id).
   For each one, check whether the table's UPDATE row-level-security policy
   restricts by ROW ONLY (e.g. `USING (auth.uid() = id)`) with no
   corresponding column-level GRANT/REVOKE restricting which columns the
   `authenticated` or `anon` role can actually write. Flag any table where a
   normal user could plausibly run `UPDATE <table> SET <privileged column> =
   ... WHERE id = auth.uid()` and have it succeed.

2. Check whether this repository has the live RLS policies checked in as SQL
   files (search for `CREATE POLICY`). If policies referenced by the app
   aren't found in the repo, flag that the real security rules may only
   exist in a cloud dashboard and are unreviewable from the code.

3. If there's a second-factor / MFA / OTP flow, trace whether the elevated
   session state it produces is checked anywhere other than a frontend route
   guard or redirect — specifically, is it checked in API middleware and/or
   in the RLS policies themselves? Flag it if the only enforcement is a
   client-side redirect, since that's bypassable by calling the API or
   database directly.

4. Find every client-side "admin-only" or "role-gated" UI component and
   confirm there is a matching SERVER-SIDE check (API middleware or RLS) for
   every action that component exposes — not just a route redirect.

For each finding: table/file, the exact escalation an attacker could perform,
and a fix (column-level GRANT/REVOKE statements, a migration file, or a
second-factor enforcement point) using this project's existing conventions.
Do not apply any fixes yet — just report.
```
