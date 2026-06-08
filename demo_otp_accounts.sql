-- ============================================================
-- Demo / Reviewer OTP accounts
-- Run this in the Supabase SQL editor against your hosted project.
-- Safe to re-run (ON CONFLICT upserts).
--
-- These accounts are recognized by src/lib/demoAccounts.ts. When you
-- privately set the server-only DEMO_OTP_SECRET env var (a 6-digit code,
-- never committed — see .env.local.example / Vercel project settings), the
-- login screen's OTP step accepts that code for exactly these emails and
-- signs them in by minting a real Supabase OTP server-side
-- (auth.admin.generateLink + verifyOtp) — no Resend email is sent, and no
-- password is ever set or checked for these accounts. The placeholder
-- password below is random and unused; it exists only because auth.users
-- requires a non-null encrypted_password column.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Make sure both demo campuses exist.
INSERT INTO public.institutions (name, email_domain)
VALUES ('Indraprastha Institute of Information Technology', 'iiitd.ac.in')
ON CONFLICT (email_domain) DO NOTHING;
-- IGDTUW (igdtuw.ac.in) is seeded by schema.sql §12 and should already exist.

DELETE FROM auth.users WHERE email IN (
  'admin@test.igdtuw', 'admin@test.iiitd',
  'student01@test.igdtuw', 'student02@test.igdtuw', 'student03@test.igdtuw',
  'student04@test.iiitd', 'student05@test.iiitd'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
  ('d0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.igdtuw', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin (IGDTUW)"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.iiitd', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin (IIITD)"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student01@test.igdtuw', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 01"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student02@test.igdtuw', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 02"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student03@test.igdtuw', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 03"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student04@test.iiitd', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 04"}', now(), now(), '', '', '', ''),
  ('d0000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student05@test.iiitd', crypt(gen_random_uuid()::text, gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 05"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', format('{"sub":"d0000001-0000-0000-0000-000000000001","email":"admin@test.igdtuw"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000002', format('{"sub":"d0000001-0000-0000-0000-000000000002","email":"admin@test.iiitd"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000003', format('{"sub":"d0000001-0000-0000-0000-000000000003","email":"student01@test.igdtuw"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000004', format('{"sub":"d0000001-0000-0000-0000-000000000004","email":"student02@test.igdtuw"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', format('{"sub":"d0000001-0000-0000-0000-000000000005","email":"student03@test.igdtuw"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000006', format('{"sub":"d0000001-0000-0000-0000-000000000006","email":"student04@test.iiitd"}')::jsonb, 'email', now(), now(), now()),
  ('d0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000007', 'd0000001-0000-0000-0000-000000000007', format('{"sub":"d0000001-0000-0000-0000-000000000007","email":"student05@test.iiitd"}')::jsonb, 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, institution_id, name, email, role)
VALUES
  ('d0000001-0000-0000-0000-000000000001', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Admin (IGDTUW)', 'admin@test.igdtuw', 'campus_admin'),
  ('d0000001-0000-0000-0000-000000000002', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Admin (IIITD)', 'admin@test.iiitd', 'campus_admin'),
  ('d0000001-0000-0000-0000-000000000003', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 01', 'student01@test.igdtuw', 'student'),
  ('d0000001-0000-0000-0000-000000000004', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 02', 'student02@test.igdtuw', 'student'),
  ('d0000001-0000-0000-0000-000000000005', (SELECT id FROM institutions WHERE email_domain = 'igdtuw.ac.in' LIMIT 1), 'Demo Student 03', 'student03@test.igdtuw', 'student'),
  ('d0000001-0000-0000-0000-000000000006', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 04', 'student04@test.iiitd', 'student'),
  ('d0000001-0000-0000-0000-000000000007', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 05', 'student05@test.iiitd', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, institution_id = EXCLUDED.institution_id;
