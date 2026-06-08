-- ============================================================
-- CampusFind: Multi-Tenant Campus Lost & Found Platform
-- Supabase SQL Schema — Phase 1
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'campus_admin', 'super_admin');
CREATE TYPE item_status AS ENUM ('lost', 'found', 'handover_to_admin', 'claimed');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================
-- 2. INSTITUTIONS TABLE
-- ============================================================
CREATE TABLE institutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email_domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  institution_id UUID REFERENCES institutions(id) ON DELETE RESTRICT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'student',
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(institution_id);

-- ============================================================
-- 4. ITEMS TABLE
-- ============================================================
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  ai_tags JSONB,
  category VARCHAR(50) NOT NULL,
  image_url TEXT,
  location_found TEXT NOT NULL,
  status item_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_tenant_status ON items(institution_id, status);
CREATE INDEX idx_items_ai_tags ON items USING gin (ai_tags);

-- ============================================================
-- 5. CLAIMS TABLE (for future phases)
-- ============================================================
CREATE TABLE claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  verification_proof TEXT NOT NULL,
  status claim_status DEFAULT 'pending',
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_claims_item ON claims(item_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- SECURITY DEFINER functions to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_auth_user_institution()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- INSTITUTIONS: public read for domain lookups during auth
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on institutions"
  ON institutions FOR SELECT
  TO anon, authenticated
  USING (true);

-- USERS: users can read their own institution's users, insert on registration
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read same institution"
  ON users FOR SELECT
  TO authenticated
  USING (institution_id = public.get_auth_user_institution());

-- WITH CHECK pins role to 'student' on self-registration and forbids changing
-- role/institution_id on self-update — otherwise any authenticated user could
-- grant themselves campus_admin/super_admin via a direct REST call
-- (auth.uid() = id alone does not constrain which columns are written).
CREATE POLICY "Users can insert own record"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'student');

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_auth_user_role()
    AND institution_id = public.get_auth_user_institution()
  );

-- ITEMS: users can only read items from their own institution
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read items from own institution"
  ON items FOR SELECT
  TO authenticated
  USING (institution_id = public.get_auth_user_institution());

CREATE POLICY "Users can insert items for own institution"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (
    institution_id = public.get_auth_user_institution()
    AND reporter_id = auth.uid()
  );

CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can update items in their institution"
  ON items FOR UPDATE
  TO authenticated
  USING (
    institution_id = public.get_auth_user_institution()
    AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
  )
  WITH CHECK (
    institution_id = public.get_auth_user_institution()
    AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
  );

-- CLAIMS: users can read their own claims, insert claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (claimant_id = auth.uid());

-- Pin status to 'pending' and forbid setting admin-only fields on self-insert —
-- otherwise a claimant could fabricate an already-"approved"/"rejected" claim
-- with a forged processed_by, impersonating an admin's decision.
CREATE POLICY "Users can insert claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    claimant_id = auth.uid()
    AND status = 'pending'
    AND processed_by IS NULL
    AND admin_notes IS NULL
  );

CREATE POLICY "Admins can read claims in their institution"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = claims.item_id 
      AND items.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );

CREATE POLICY "Admins can update claims in their institution"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = claims.item_id 
      AND items.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );

-- ============================================================
-- 7. INSTITUTIONS: Add locker coordinates
-- ============================================================
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS locker_coordinates TEXT;

-- ============================================================
-- 8. DISPUTES TABLE
-- ============================================================
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

CREATE TABLE disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  issue_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status dispute_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_disputes_user ON disputes(user_id);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert disputes"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can read all disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Super admins can insert institutions
CREATE POLICY "Super admins can insert institutions"
  ON institutions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ============================================================
-- 9. AI MATCHING ENGINE — matches & notifications
-- ============================================================

CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lost_item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  found_item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(4,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX idx_matches_lost_item ON matches(lost_item_id);
CREATE INDEX idx_matches_found_item ON matches(found_item_id);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Matches are written server-side via the service-role client (bypasses RLS).
-- Reporters of either side of a match may read it.
CREATE POLICY "Reporters can read their item matches"
  ON matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM items WHERE items.id = matches.lost_item_id AND items.reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM items WHERE items.id = matches.found_item_id AND items.reporter_id = auth.uid())
  );

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications are inserted server-side via the service-role client
-- (bypasses RLS) — users may only read and update (mark-as-read) their own.
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. CRYPTOGRAPHIC PICKUP TOKENS — claim release flow
-- ============================================================

CREATE TABLE pickup_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pickup_tokens_claim ON pickup_tokens(claim_id);
CREATE INDEX idx_pickup_tokens_token ON pickup_tokens(token);

ALTER TABLE pickup_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are minted and redeemed server-side via the service-role client
-- (bypasses RLS, signature/expiry/single-use checks happen in the API routes).
-- Claimants may read their own token to render the QR code; admins may read
-- tokens for items in their institution to support the release scan.
CREATE POLICY "Claimants can read own pickup tokens"
  ON pickup_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM claims WHERE claims.id = pickup_tokens.claim_id AND claims.claimant_id = auth.uid())
  );

CREATE POLICY "Admins can read pickup tokens in their institution"
  ON pickup_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = pickup_tokens.item_id
      AND items.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );

-- ============================================================
-- 11. OTP AUTH RATE LIMITING
-- ============================================================

-- Tracks per-email OTP send cadence so /api/auth/send-otp can enforce a
-- cooldown + hourly cap (the OTP codes themselves are minted and verified
-- entirely by Supabase Auth — this table never stores a code).
CREATE TABLE otp_requests (
  email TEXT PRIMARY KEY,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts INT NOT NULL DEFAULT 0
);

ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;
-- No public policies — all reads/writes happen server-side via the
-- service-role client inside the OTP API routes.

-- ============================================================
-- 13. FEATURE UPGRADE — private secret, AI claim scoring, chat
--     (see feature_upgrade.sql for the standalone idempotent migration)
-- ============================================================

-- items: a private detail only the finder knows; never shown publicly.
ALTER TABLE items ADD COLUMN IF NOT EXISTS secret_hint TEXT;

-- items: let the reporter delete their own item.
CREATE POLICY "Reporters delete own items"
  ON items FOR DELETE TO authenticated
  USING (reporter_id = auth.uid());

-- claims: AI accuracy of the claimant's answer + the AI's short explanation.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_match_score NUMERIC(5,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- The finder (item reporter) — not just admins — can read & resolve claims
-- on their own items (student-to-student resolution).
CREATE POLICY "Reporters read claims on their items"
  ON claims FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid()));

CREATE POLICY "Reporters update claims on their items"
  ON claims FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid()));

-- messages: claim-scoped chat between claimant and finder.
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_claim ON messages(claim_id, created_at);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_claim_participant(_claim_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM claims c JOIN items i ON i.id = c.item_id
    WHERE c.id = _claim_id AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
  );
$$;

CREATE POLICY "Participants read claim messages"
  ON messages FOR SELECT TO authenticated USING (public.is_claim_participant(claim_id));
CREATE POLICY "Participants send claim messages"
  ON messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_claim_participant(claim_id));
CREATE POLICY "Admins read messages in institution"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM claims c JOIN items i ON i.id = c.item_id
    WHERE c.id = messages.claim_id AND i.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
  ));

-- ============================================================
-- 14. RETURN WINDOW + CLAIM DISPUTES
--     (see feature_upgrade_2.sql for the standalone idempotent migration)
-- ============================================================

ALTER TABLE items ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

CREATE TABLE claim_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  finder_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE (item_id, reporter_id)
);
CREATE INDEX idx_claim_disputes_item ON claim_disputes(item_id);
ALTER TABLE claim_disputes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dispute_participant(_dispute_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM claim_disputes d WHERE d.id = _dispute_id
    AND (d.finder_id = auth.uid() OR d.receiver_id = auth.uid() OR d.reporter_id = auth.uid()));
$$;

CREATE POLICY "Participants read disputes" ON claim_disputes FOR SELECT TO authenticated
  USING (finder_id = auth.uid() OR receiver_id = auth.uid() OR reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM items i WHERE i.id = claim_disputes.item_id
      AND i.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')));

CREATE TABLE dispute_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID REFERENCES claim_disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_dispute_messages_dispute ON dispute_messages(dispute_id, created_at);
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read dispute messages" ON dispute_messages FOR SELECT TO authenticated
  USING (public.is_dispute_participant(dispute_id));
CREATE POLICY "Participants send dispute messages" ON dispute_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_dispute_participant(dispute_id));
CREATE POLICY "Admins read dispute messages" ON dispute_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM claim_disputes d JOIN items i ON i.id = d.item_id
    WHERE d.id = dispute_messages.dispute_id AND i.institution_id = public.get_auth_user_institution()
      AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')));

-- ============================================================
-- 15. ONBOARDING PROFILE FIELDS
--     (see feature_upgrade_3.sql)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;

-- ============================================================
-- 12. SEED DATA
-- ============================================================

-- Seed institution: IGDTUW
INSERT INTO institutions (id, name, email_domain) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Indira Gandhi Delhi Technical University for Women', 'igdtuw.ac.in');

-- Note: Mock items will be seeded via the application after
-- a user registers. For dev purposes, you can manually insert
-- test items after creating a test user through the auth flow.
