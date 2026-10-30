-- ============================================================
--  Nasmat Ward Gifts — Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────
--  Admin users
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'superadmin')),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  Products
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji        VARCHAR(10)  NOT NULL DEFAULT '💐',
  name         VARCHAR(200) NOT NULL,
  sub          VARCHAR(300),
  category     VARCHAR(50)  NOT NULL
               CHECK (category IN ('bouquets','plants','gifts','wedding')),
  price        VARCHAR(100),
  badge        VARCHAR(100),
  badge_style  VARCHAR(20)  NOT NULL DEFAULT 'forest'
               CHECK (badge_style IN ('forest','gold','rose')),
  available    BOOLEAN      NOT NULL DEFAULT true,
  fresh        BOOLEAN      NOT NULL DEFAULT true,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
--  Audit log
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  username    VARCHAR(50),
  action      VARCHAR(50)  NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log (action);

-- ────────────────────────────────────────────────────────────
--  Default admin account (password: flowers2024)
--  Change this immediately after first login!
--  Generate a new hash: node -e "const b=require('bcryptjs');console.log(b.hashSync('YOUR_NEW_PASSWORD',12))"
-- ────────────────────────────────────────────────────────────
INSERT INTO admin_users (username, password_hash, role)
VALUES (
  'nasmat',
  '$2a$12$LQv3c1yqBWVHxkd0LQ4z7OKbx6e5f2r1Uw3d9gZqmn0pXC8bJvSwa',
  'superadmin'
)
ON CONFLICT (username) DO NOTHING;

-- ────────────────────────────────────────────────────────────
--  Default products (same 8 as the site defaults)
-- ────────────────────────────────────────────────────────────
INSERT INTO products (emoji, name, sub, category, price, badge, badge_style, sort_order) VALUES
  ('💐','Desert Rose Bouquet','12 stems · Same-day Dubai','bouquets','From AED 149','Bestseller','forest',1),
  ('🌹','Grand Red Rose Bundle','24 roses · Velvet box wrap','bouquets','From AED 249','Romantic','rose',2),
  ('🌿','Peace Lily Plant','Indoor · Low maintenance','plants','From AED 99','Air-Purifying','forest',3),
  ('🎁','Luxury Bloom Box','Flowers + chocolates + card','gifts','From AED 349','Gift Set','gold',4),
  ('💍','Bridal Bouquet','Custom · Consultation required','wedding','From AED 699','Wedding','gold',5),
  ('🌷','Tulip Spring Mix','15 stems · Kraft wrap','bouquets','From AED 189','Seasonal','forest',6),
  ('🌴','Ghaf Bonsai','Potted · Decorative ceramic','plants','From AED 179','UAE Native','forest',7),
  ('✨','Arabic Occasion Box','Orchids + dates + oud mist','gifts','From AED 449','Eid Special','rose',8)
ON CONFLICT DO NOTHING;
