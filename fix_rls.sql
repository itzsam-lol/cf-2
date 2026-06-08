-- ============================================================
-- RLS Infinite Recursion Fix
-- ============================================================

-- 1. Create a SECURITY DEFINER function to fetch the current user's institution ID bypassing RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_institution()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM users WHERE id = auth.uid();
$$;

-- 2. Create a SECURITY DEFINER function to fetch the current user's role bypassing RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- 3. Replace the offending 'users' policy
DROP POLICY IF EXISTS "Users can read same institution" ON users;
CREATE POLICY "Users can read same institution"
  ON users FOR SELECT
  TO authenticated
  USING (institution_id = public.get_auth_user_institution());

-- 4. Replace the offending 'items' policy
DROP POLICY IF EXISTS "Users can read items from own institution" ON items;
CREATE POLICY "Users can read items from own institution"
  ON items FOR SELECT
  TO authenticated
  USING (institution_id = public.get_auth_user_institution());

DROP POLICY IF EXISTS "Users can insert items for own institution" ON items;
CREATE POLICY "Users can insert items for own institution"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (
    institution_id = public.get_auth_user_institution()
    AND reporter_id = auth.uid()
  );

-- 5. Replace the offending 'claims' admin policy
DROP POLICY IF EXISTS "Admins can read claims in their institution" ON claims;
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

DROP POLICY IF EXISTS "Admins can update claims in their institution" ON claims;
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
