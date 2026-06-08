-- ============================================================
-- Security Hardening: close privilege-escalation gaps in RLS
-- Run this in the Supabase SQL editor against your hosted project.
-- Safe to re-run (DROP POLICY IF EXISTS before each CREATE POLICY).
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS — self-registration/update must not be able to set
--    role or institution_id. Previously "auth.uid() = id" was the
--    *only* check, so any authenticated user could grant themselves
--    campus_admin/super_admin (or jump institutions) with a direct
--    REST call to PostgREST — completely bypassing the app's UI.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own record" ON users;
CREATE POLICY "Users can insert own record"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_auth_user_role()
    AND institution_id = public.get_auth_user_institution()
  );

-- ------------------------------------------------------------
-- 2. CLAIMS — self-insert must not be able to set status,
--    processed_by, or admin_notes. Previously a claimant could
--    insert a row that already looked "approved"/"rejected" with
--    a forged processed_by, impersonating an admin's decision.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert claims" ON claims;
CREATE POLICY "Users can insert claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    claimant_id = auth.uid()
    AND status = 'pending'
    AND processed_by IS NULL
    AND admin_notes IS NULL
  );

-- ------------------------------------------------------------
-- 3. OTP_REQUESTS — add a failed-attempt counter so
--    /api/auth/verify-otp can lock out brute-force guessing of
--    the 6-digit code (1,000,000 possibilities is guessable with
--    enough unrate-limited attempts within the code's validity window).
-- ------------------------------------------------------------
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
