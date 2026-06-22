-- Cash expenses logged during an open session (petty cash out of drawer)
CREATE TABLE cash_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES branches(id),
  cash_session_id uuid NOT NULL REFERENCES cash_sessions(id),
  cashier_id      uuid NOT NULL REFERENCES users(id),
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('supplier_payment','tip','cleaning','maintenance','staff','other')),
  amount_usd      integer NOT NULL DEFAULT 0,
  amount_lbp      integer NOT NULL DEFAULT 0,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cash_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_isolation" ON cash_expenses
  USING (organization_id = public.auth_org_id());

CREATE POLICY "expenses_insert" ON cash_expenses
  FOR INSERT WITH CHECK (organization_id = public.auth_org_id());

CREATE INDEX idx_cash_expenses_session ON cash_expenses(cash_session_id);
