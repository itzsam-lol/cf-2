-- ============================================================
-- CampusFind feature upgrade #2 — return window + claim disputes
-- Run ONCE in the Supabase SQL editor (idempotent — safe to re-run).
--
-- Adds:
--   • items.returned_at        — when the handover was confirmed; drives the
--                                24h "Returned" window in the active feed.
--   • claim_disputes           — a third party reports the wrong person
--                                received an item ("fake receiver"). Created &
--                                closed ONLY server-side via service-role API
--                                routes, so the finder/receiver participants
--                                can't be forged by a client, and a single
--                                user can open at most one dispute per item.
--   • dispute_messages         — the 3-way chat (finder + receiver + reporter).
--
-- Anti-abuse summary:
--   - UNIQUE(item_id, reporter_id) blocks repeat-spam by the same user.
--   - No client INSERT/UPDATE policy on claim_disputes → all writes go through
--     the API, which validates the 24h window, institution, and that the
--     reporter is neither the finder nor the receiver.
--   - Only the three named participants (and institution admins, read-only)
--     can see a dispute or its chat.
-- ============================================================

ALTER TABLE items ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS claim_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  finder_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',     -- open | closed
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  UNIQUE (item_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_claim_disputes_item ON claim_disputes(item_id);

ALTER TABLE claim_disputes ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper: is the current user one of the dispute's parties?
CREATE OR REPLACE FUNCTION public.is_dispute_participant(_dispute_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM claim_disputes d
    WHERE d.id = _dispute_id
      AND (d.finder_id = auth.uid() OR d.receiver_id = auth.uid() OR d.reporter_id = auth.uid())
  );
$$;

-- Read: the three participants, plus institution admins for oversight.
DROP POLICY IF EXISTS "Participants read disputes" ON claim_disputes;
CREATE POLICY "Participants read disputes"
  ON claim_disputes FOR SELECT TO authenticated
  USING (
    finder_id = auth.uid() OR receiver_id = auth.uid() OR reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM items i
      WHERE i.id = claim_disputes.item_id
        AND i.institution_id = public.get_auth_user_institution()
        AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );
-- (No client INSERT/UPDATE policy — disputes are created & closed via the
--  service-role API routes only.)

CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID REFERENCES claim_disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id, created_at);

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read dispute messages" ON dispute_messages;
CREATE POLICY "Participants read dispute messages"
  ON dispute_messages FOR SELECT TO authenticated
  USING (public.is_dispute_participant(dispute_id));

DROP POLICY IF EXISTS "Participants send dispute messages" ON dispute_messages;
CREATE POLICY "Participants send dispute messages"
  ON dispute_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_dispute_participant(dispute_id));

DROP POLICY IF EXISTS "Admins read dispute messages" ON dispute_messages;
CREATE POLICY "Admins read dispute messages"
  ON dispute_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claim_disputes d JOIN items i ON i.id = d.item_id
      WHERE d.id = dispute_messages.dispute_id
        AND i.institution_id = public.get_auth_user_institution()
        AND (public.get_auth_user_role() = 'campus_admin' OR public.get_auth_user_role() = 'super_admin')
    )
  );
