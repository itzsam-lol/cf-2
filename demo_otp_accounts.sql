-- ============================================================
-- Demo / Reviewer OTP accounts
-- Run this in the Supabase SQL editor against your hosted project.
-- Safe to re-run (idempotent: deletes then re-creates the fixed set).
--
-- These accounts use the REAL institutional domains (igdtuw.ac.in /
-- iiitd.ac.in) so they pass every domain check just like a normal student.
-- They are recognized by src/lib/demoAccounts.ts: when you privately set the
-- server-only DEMO_OTP_SECRET env var (a 6-digit code, never committed —
-- configured in Vercel / .env.local), the login screen's OTP step accepts
-- that code for exactly these emails and signs them in by minting a real
-- Supabase OTP server-side (auth.admin.generateLink + verifyOtp) — no Resend
-- email is sent, and no password is ever set or checked for these accounts.
-- The placeholder password below is random and unused; it exists only because
-- auth.users requires a non-null encrypted_password column.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Make sure both demo campuses exist.
INSERT INTO public.institutions (name, email_domain)
VALUES ('Indraprastha Institute of Information Technology', 'iiitd.ac.in')
ON CONFLICT (email_domain) DO NOTHING;
-- IGDTUW (igdtuw.ac.in) is seeded by schema.sql §12 and should already exist.

-- Remove the previous demo set (old @test.xxxx addresses) AND any prior run of
-- the current addresses, so this script can be re-run cleanly.
DELETE FROM auth.users WHERE email IN (
  -- old addresses (deprecated)
  'admin@test.igdtuw', 'admin@test.iiitd',
  'student01@test.igdtuw', 'student02@test.igdtuw', 'student03@test.igdtuw',
  'student04@test.iiitd', 'student05@test.iiitd',
  -- current addresses
  'admin@igdtuw.ac.in', 'admin@iiitd.ac.in',
  'student01@igdtuw.ac.in', 'student02@igdtuw.ac.in', 'student03@igdtuw.ac.in',
  'student04@iiitd.ac.in', 'student05@iiitd.ac.in'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@igdtuw.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin (IGDTUW)"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@iiitd.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin (IIITD)"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student01@igdtuw.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 01"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student02@igdtuw.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 02"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student03@igdtuw.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 03"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student04@iiitd.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 04"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student05@iiitd.ac.in', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 05"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', format('{"sub":"d0000001-0000-0000-0000-000000000001","email":"admin@igdtuw.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', format('{"sub":"d0000001-0000-0000-0000-000000000002","email":"admin@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', format('{"sub":"d0000001-0000-0000-0000-000000000003","email":"student01@igdtuw.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', format('{"sub":"d0000001-0000-0000-0000-000000000004","email":"student02@igdtuw.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', format('{"sub":"d0000001-0000-0000-0000-000000000005","email":"student03@igdtuw.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000006', format('{"sub":"d0000001-0000-0000-0000-000000000006","email":"student04@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000007', format('{"sub":"d0000001-0000-0000-0000-000000000007","email":"student05@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO UPDATE SET identity_data = EXCLUDED.identity_data;

INSERT INTO public.users (id, institution_id, name, email, role)
VALUES
  ('d0000001-0000-0000-0000-000000000001', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Admin (IGDTUW)', 'admin@igdtuw.ac.in', 'campus_admin'),
  ('d0000001-0000-0000-0000-000000000002', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Admin (IIITD)', 'admin@iiitd.ac.in', 'campus_admin'),
  ('d0000001-0000-0000-0000-000000000003', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 01', 'student01@igdtuw.ac.in', 'student'),
  ('d0000001-0000-0000-0000-000000000004', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 02', 'student02@igdtuw.ac.in', 'student'),
  ('d0000001-0000-0000-0000-000000000005', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 03', 'student03@igdtuw.ac.in', 'student'),
  ('d0000001-0000-0000-0000-000000000006', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 04', 'student04@iiitd.ac.in', 'student'),
  ('d0000001-0000-0000-0000-000000000007', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 05', 'student05@iiitd.ac.in', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, institution_id = EXCLUDED.institution_id, email = EXCLUDED.email, name = EXCLUDED.name;
