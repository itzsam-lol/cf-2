-- ============================================================
-- DEMO USERS SEED FILE (For Testing/Development Only)
-- Run this in your Supabase SQL Editor to bypass Google Auth.
-- Note: This requires Email/Password Auth to be enabled in Supabase Settings.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0. Clean up previous failed attempts
DELETE FROM auth.users WHERE email IN ('student1@iiitd.ac.in', 'student2@iiitd.ac.in', 'admin@iiitd.ac.in');

-- 1. Insert into auth.users (Supabase Authentication Table)
INSERT INTO auth.users (
  id, 
  instance_id, 
  aud, 
  role, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  created_at, 
  updated_at, 
  confirmation_token, 
  email_change, 
  email_change_token_new, 
  recovery_token
)
VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student1@iiitd.ac.in', crypt('password123', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 1", "avatar_url": "https://i.pravatar.cc/150?u=1"}', now(), now(), '', '', '', ''),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student2@iiitd.ac.in', crypt('password123', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Student 2", "avatar_url": "https://i.pravatar.cc/150?u=2"}', now(), now(), '', '', '', ''),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@iiitd.ac.in', crypt('password123', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Global Admin", "avatar_url": "https://i.pravatar.cc/150?u=3"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert into auth.identities
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', format('{"sub":"11111111-1111-1111-1111-111111111111","email":"student1@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now()),
('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', format('{"sub":"22222222-2222-2222-2222-222222222222","email":"student2@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now()),
('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', format('{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@iiitd.ac.in"}')::jsonb, 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- 3. Insert into public.users (CampusFind App Table)
-- Ensure IIITD institution exists for our demo users
INSERT INTO public.institutions (name, email_domain) 
VALUES ('Indraprastha Institute of Information Technology', 'iiitd.ac.in')
ON CONFLICT (email_domain) DO NOTHING;

INSERT INTO public.users (id, institution_id, name, email, avatar_url, role)
VALUES
('11111111-1111-1111-1111-111111111111', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 1', 'student1@iiitd.ac.in', 'https://i.pravatar.cc/150?u=1', 'student'),
('22222222-2222-2222-2222-222222222222', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Student 2', 'student2@iiitd.ac.in', 'https://i.pravatar.cc/150?u=2', 'student'),
('33333333-3333-3333-3333-333333333333', (SELECT id FROM institutions WHERE email_domain = 'iiitd.ac.in' LIMIT 1), 'Demo Global Admin', 'admin@iiitd.ac.in', 'https://i.pravatar.cc/150?u=3', 'super_admin')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
