-- Customer accounts with running balance (positive = customer owes us)
CREATE TABLE customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  phone           text,
  email           text,
  credit_limit_usd integer NOT NULL DEFAULT 0, -- 0 = no limit
  balance_usd     integer NOT NULL DEFAULT 0,  -- cents, positive = owes money
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_isolation" ON customers
  USING (organization_id = public.auth_org_id());
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (organization_id = public.auth_org_id());
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (organization_id = public.auth_org_id());

CREATE INDEX idx_customers_org ON customers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone ON customers(organization_id, phone) WHERE deleted_at IS NULL;

-- Ledger: every charge (sale on account) and payment recorded here
CREATE TABLE customer_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id),
  type            text NOT NULL CHECK (type IN ('charge','payment','adjustment')),
  amount_usd      integer NOT NULL, -- always positive
  sale_id         uuid REFERENCES sales(id),
  note            text,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_tx_isolation" ON customer_transactions
  USING (organization_id = public.auth_org_id());
CREATE POLICY "cust_tx_insert" ON customer_transactions
  FOR INSERT WITH CHECK (organization_id = public.auth_org_id());

CREATE INDEX idx_cust_tx_customer ON customer_transactions(customer_id, created_at DESC);
