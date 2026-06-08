-- ============================================================
-- CampusFind feature upgrade #3 — onboarding profile fields
-- Run ONCE in the Supabase SQL editor (idempotent — safe to re-run).
--
-- Adds the fields collected on the post-login onboarding screen. Users update
-- these on their own row; the existing "Users can update own record" RLS
-- policy already permits it (role/institution stay pinned).
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;
