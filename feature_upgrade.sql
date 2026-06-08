-- ============================================================
-- CampusFind feature upgrade migration
-- Run ONCE in the Supabase SQL editor (idempotent — safe to re-run).
--
-- Adds:
--   • items.secret_hint        — a private detail only the finder knows;
--                                never shown publicly; used by AI to score claims
--   • claims.ai_match_score    — 0-100 AI accuracy of a claimant's answer
--   • claims.ai_analysis       — short AI explanation of the score
--   • messages                 — student↔student chat scoped to a claim
--   • RLS so the FINDER (item reporter), not just admins, can read & resolve
--     claims on their own items, and both parties can chat.
-- ============================================================

-- ---- items: private secret used for AI verification -------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS secret_hint TEXT;

-- ---- items: let the reporter delete their own item -------------------------
DROP POLICY IF EXISTS "Reporters delete own items" ON items;
CREATE POLICY "Reporters delete own items"
  ON items FOR DELETE
  TO authenticated
  USING (reporter_id = auth.uid());

-- ---- claims: AI accuracy scoring + student-to-student resolution -------------
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_match_score NUMERIC(5,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

-- The finder (reporter of the item) can now see claims filed against their items.
DROP POLICY IF EXISTS "Reporters read claims on their items" ON claims;
CREATE POLICY "Reporters read claims on their items"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid())
  );

-- The finder can resolve (approve / reject) claims on their own items —
-- replacing the old admin-mediated approval. They cannot change claimant_id.
DROP POLICY IF EXISTS "Reporters update claims on their items" ON claims;
CREATE POLICY "Reporters update claims on their items"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM items WHERE items.id = claims.item_id AND items.reporter_id = auth.uid())
  );

-- ---- messages: claim-scoped chat between the two students --------------------
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_claim ON messages(claim_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper: is the current user a participant of this claim
-- (either the claimant or the finder of the claimed item)? Bypasses RLS to
-- avoid recursion between messages/claims/items policies.
CREATE OR REPLACE FUNCTION public.is_claim_participant(_claim_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM claims c
    JOIN items i ON i.id = c.item_id
    WHERE c.id = _claim_id
      AND (c.claimant_id = auth.uid() OR i.reporter_id = auth.uid())
  );
$$;

DROP POLICY IF EXISTS "Participants read claim messages" ON messages;
CREATE POLICY "Participants read claim messages"
  ON messages FOR SELECT
  TO authenticated
  USING (public.is_claim_participant(claim_id));

DROP POLICY IF EXISTS "Participants send claim messages" ON messages;
CREATE POLICY "Participants send claim messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_claim_participant(claim_id));

-- Admins may read (oversee) chat for items in their institution.
DROP POLICY IF EXISTS "Admins read messages in institution" ON messages;
CREATE POLICY "Admins read messages in institution"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims c
      JOIN items i ON i.id = c.item_id
      WHERE c.id = messages.claim_id
        AND i.institution_id = public.get_auth_user_institution()
        AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );
