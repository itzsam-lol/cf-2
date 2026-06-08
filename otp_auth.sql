-- ============================================================
-- Campus-Specific OTP Email Authentication
-- Run this in the Supabase SQL editor against your hosted project.
-- Safe to re-run: the table is created only if missing.
-- ============================================================

-- Tracks per-email OTP send cadence so /api/auth/send-otp can enforce a
-- cooldown + hourly cap (the OTP codes themselves are minted and verified
-- entirely by Supabase Auth via generateLink()/verifyOtp() — this table
-- never stores a code).
CREATE TABLE IF NOT EXISTS otp_requests (
  email TEXT PRIMARY KEY,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts INT NOT NULL DEFAULT 0
);

-- Safe to re-run against a table created by an earlier version of this file.
ALTER TABLE otp_requests ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;

ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;
-- No public policies — all reads/writes happen server-side via the
-- service-role client inside the OTP API routes.
