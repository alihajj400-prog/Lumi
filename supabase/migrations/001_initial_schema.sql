-- LUMI POS & Stock — Initial Schema
-- Run this in the Supabase SQL editor for your project.
-- All monetary values: USD in cents (integer), LBP in piasters (integer).
-- Exchange rate stored as integer × 1000 (90000 = 90,000 LBP/USD).

-- ─────────────────────────────────────────────
-- ORGANIZATIONS
-- ─────────────────────────────────────────────
CREATE TABLE organizations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  name_ar          text,
  slug             text UNIQUE NOT NULL,
  subscription_plan text NOT NULL DEFAULT 'starter'
                   CHECK (subscription_plan IN ('starter','growth','pro','enterprise')),
  exchange_rate    integer NOT NULL DEFAULT 90000,
  vat_enabled      boolean NOT NULL DEFAULT false,
  vat_rate         numeric(5,2) NOT NULL DEFAULT 11.00,
  default_currency text NOT NULL DEFAULT 'USD' CHECK (default_currency IN ('USD','LBP')),
  logo_url         text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON organizations FOR SELECT
  USING (id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- BRANCHES
-- ─────────────────────────────────────────────
CREATE TABLE branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  phone           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_isolation" ON branches
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- USERS (app profile, extends auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(id),
  full_name       text NOT NULL,
  role            text NOT NULL DEFAULT 'cashier'
                  CHECK (role IN ('admin','manager','cashier','stock_clerk','accountant')),
  pin_hash        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_isolation" ON users
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  name_ar         text,
  color           text,
  icon            text,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_isolation" ON categories
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(id),
  category_id     uuid REFERENCES categories(id),
  name            text NOT NULL,
  name_ar         text,
  sku             text NOT NULL,
  barcode         text,
  unit            text NOT NULL DEFAULT 'piece'
                  CHECK (unit IN ('piece','kg','g','liter','ml','box','pack','dozen','carton')),
  price_usd       integer NOT NULL DEFAULT 0,
  price_lbp       integer NOT NULL DEFAULT 0,
  cost_usd        integer NOT NULL DEFAULT 0,
  tax_rate        numeric(5,2) NOT NULL DEFAULT 0,
  is_composite    boolean NOT NULL DEFAULT false,
  track_stock     boolean NOT NULL DEFAULT true,
  stock_qty       numeric(12,3) NOT NULL DEFAULT 0,
  reorder_level   numeric(12,3) NOT NULL DEFAULT 0,
  expiry_date     date,
  image_url       text,
  is_active       boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_isolation" ON products
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX idx_products_org_sku     ON products(organization_id, sku);
CREATE INDEX idx_products_org_barcode ON products(organization_id, barcode);
CREATE INDEX idx_products_org_cat     ON products(organization_id, category_id);

-- ─────────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────────
CREATE TABLE suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  payment_terms   text,
  currency        text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','LBP')),
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_isolation" ON suppliers
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- PURCHASES
-- ─────────────────────────────────────────────
CREATE TABLE purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES branches(id),
  supplier_id     uuid NOT NULL REFERENCES suppliers(id),
  po_number       text UNIQUE NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partial','received','cancelled')),
  ordered_at      date,
  expected_at     date,
  received_at     date,
  invoice_number  text,
  invoice_url     text,
  subtotal_usd    integer NOT NULL DEFAULT 0,
  total_usd       integer NOT NULL DEFAULT 0,
  amount_paid_usd integer NOT NULL DEFAULT 0,
  payment_status  text NOT NULL DEFAULT 'unpaid'
                  CHECK (payment_status IN ('unpaid','partial','paid')),
  notes           text,
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_isolation" ON purchases
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX idx_purchases_supplier_status ON purchases(supplier_id, status);

-- ─────────────────────────────────────────────
-- PURCHASE ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE purchase_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id   uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id),
  ordered_qty   numeric(12,3) NOT NULL,
  received_qty  numeric(12,3) NOT NULL DEFAULT 0,
  unit_cost_usd integer NOT NULL,
  total_cost_usd integer NOT NULL DEFAULT 0
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items_isolation" ON purchase_items
  USING (purchase_id IN (
    SELECT id FROM purchases
    WHERE organization_id = (auth.jwt() ->> 'org_id')::uuid
  ));

-- ─────────────────────────────────────────────
-- CASH SESSIONS
-- ─────────────────────────────────────────────
CREATE TABLE cash_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id),
  cashier_id          uuid NOT NULL REFERENCES users(id),
  opened_at           timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  opening_cash_usd    integer NOT NULL DEFAULT 0,
  opening_cash_lbp    integer NOT NULL DEFAULT 0,
  closing_cash_usd    integer,
  expected_cash_usd   integer,
  difference_usd      integer,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_isolation" ON cash_sessions
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX idx_cash_sessions_cashier_status ON cash_sessions(cashier_id, status);

-- ─────────────────────────────────────────────
-- SALES
-- ─────────────────────────────────────────────
CREATE TABLE sales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id),
  cash_session_id     uuid NOT NULL REFERENCES cash_sessions(id),
  cashier_id          uuid NOT NULL REFERENCES users(id),
  customer_id         uuid,
  sale_number         text UNIQUE NOT NULL,
  status              text NOT NULL DEFAULT 'completed'
                      CHECK (status IN ('completed','voided','refunded','held')),
  subtotal_usd        integer NOT NULL,
  discount_amount_usd integer NOT NULL DEFAULT 0,
  tax_amount_usd      integer NOT NULL DEFAULT 0,
  total_usd           integer NOT NULL,
  total_lbp           integer NOT NULL,
  exchange_rate_used  integer NOT NULL,
  is_return           boolean NOT NULL DEFAULT false,
  original_sale_id    uuid REFERENCES sales(id),
  void_reason         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_isolation" ON sales
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX idx_sales_org_date      ON sales(organization_id, created_at);
CREATE INDEX idx_sales_cashier_date  ON sales(cashier_id, created_at);
CREATE INDEX idx_sales_session       ON sales(cash_session_id);

-- ─────────────────────────────────────────────
-- SALE ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE sale_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id),
  product_name        text NOT NULL,
  quantity            numeric(12,3) NOT NULL,
  unit_price_usd      integer NOT NULL,
  unit_price_lbp      integer NOT NULL,
  discount_amount_usd integer NOT NULL DEFAULT 0,
  line_total_usd      integer NOT NULL
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items_isolation" ON sale_items
  USING (sale_id IN (
    SELECT id FROM sales
    WHERE organization_id = (auth.jwt() ->> 'org_id')::uuid
  ));

CREATE INDEX idx_sale_items_sale_product ON sale_items(sale_id, product_id);

-- ─────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method           text NOT NULL
                   CHECK (method IN ('cash_usd','cash_lbp','card','whish','omt','bob_finance','bank_transfer','other')),
  amount_usd       integer NOT NULL DEFAULT 0,
  amount_lbp       integer NOT NULL DEFAULT 0,
  reference_number text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_isolation" ON payments
  USING (sale_id IN (
    SELECT id FROM sales
    WHERE organization_id = (auth.jwt() ->> 'org_id')::uuid
  ));

CREATE INDEX idx_payments_sale ON payments(sale_id);

-- ─────────────────────────────────────────────
-- STOCK MOVEMENTS (append-only audit log)
-- ─────────────────────────────────────────────
CREATE TABLE stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES branches(id),
  product_id      uuid NOT NULL REFERENCES products(id),
  movement_type   text NOT NULL
                  CHECK (movement_type IN ('sale','return','purchase','adjustment','waste','damage','opening')),
  quantity        numeric(12,3) NOT NULL,
  unit_cost_usd   integer,
  reference_id    uuid,
  reference_type  text CHECK (reference_type IN ('sale','purchase','manual')),
  reason          text,
  performed_by    uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- Append-only: SELECT + INSERT only, no UPDATE/DELETE
CREATE POLICY "stock_movements_read" ON stock_movements FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT
  WITH CHECK (organization_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at);
CREATE INDEX idx_stock_movements_org_branch   ON stock_movements(organization_id, branch_id, created_at);

-- ─────────────────────────────────────────────
-- SETTINGS (one row per org)
-- ─────────────────────────────────────────────
CREATE TABLE settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  currency_display      text NOT NULL DEFAULT 'both' CHECK (currency_display IN ('usd','lbp','both')),
  receipt_language      text NOT NULL DEFAULT 'en' CHECK (receipt_language IN ('en','ar','both')),
  receipt_header        text,
  receipt_footer        text NOT NULL DEFAULT 'Thank you!',
  invoice_prefix        text NOT NULL DEFAULT 'INV',
  po_prefix             text NOT NULL DEFAULT 'PO',
  low_stock_alert_days  integer NOT NULL DEFAULT 3,
  expiry_alert_days     integer NOT NULL DEFAULT 14,
  fiscal_year_start     integer NOT NULL DEFAULT 1,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_isolation" ON settings
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- ACTIVITY LOGS (append-only audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE activity_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_read" ON activity_logs FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT
  WITH CHECK (organization_id = (auth.jwt() ->> 'org_id')::uuid);

-- ─────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
