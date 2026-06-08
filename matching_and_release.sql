-- ============================================================
-- AI Matching Engine + Cryptographic Pickup/Release Flow
-- Run this in the Supabase SQL editor against your hosted project.
-- Safe to re-run: tables are created only if missing, policies are
-- dropped and recreated.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Admins can update items in their institution
--    (needed so claim approval / release can flip item status)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update items in their institution" ON items;
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

-- ------------------------------------------------------------
-- 2. AI Matching Engine — matches & notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lost_item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  found_item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(4,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lost_item_id, found_item_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_lost_item ON matches(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_matches_found_item ON matches(found_item_id);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters can read their item matches" ON matches;
CREATE POLICY "Reporters can read their item matches"
  ON matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM items WHERE items.id = matches.lost_item_id AND items.reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM items WHERE items.id = matches.found_item_id AND items.reporter_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Cryptographic pickup tokens — claim release flow
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pickup_tokens_claim ON pickup_tokens(claim_id);
CREATE INDEX IF NOT EXISTS idx_pickup_tokens_token ON pickup_tokens(token);

ALTER TABLE pickup_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Claimants can read own pickup tokens" ON pickup_tokens;
CREATE POLICY "Claimants can read own pickup tokens"
  ON pickup_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM claims WHERE claims.id = pickup_tokens.claim_id AND claims.claimant_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can read pickup tokens in their institution" ON pickup_tokens;
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
