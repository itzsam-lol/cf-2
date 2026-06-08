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
  USING (
    institution_id = (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own record"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ITEMS: users can only read items from their own institution
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read items from own institution"
  ON items FOR SELECT
  TO authenticated
  USING (
    institution_id = (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items for own institution"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (
    institution_id = (
      SELECT institution_id FROM users WHERE id = auth.uid()
    )
    AND reporter_id = auth.uid()
  );

CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

-- CLAIMS: users can read their own claims, insert claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (claimant_id = auth.uid());

CREATE POLICY "Users can insert claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (claimant_id = auth.uid());

-- ============================================================
-- 7. SEED DATA
-- ============================================================

-- Seed institution: IGDTUW
INSERT INTO institutions (id, name, email_domain) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Indira Gandhi Delhi Technical University for Women', 'igdtuw.ac.in');

-- Note: Mock items will be seeded via the application after
-- a user registers. For dev purposes, you can manually insert
-- test items after creating a test user through the auth flow.
