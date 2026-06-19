-- Resolve org context from JWT org_id claim OR the signed-in user's profile.
-- Fixes RLS when the custom access token hook has not yet issued org_id.

CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'org_id', '')::uuid,
    (SELECT organization_id FROM public.users WHERE id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated;

-- Bootstrap reads (also work when auth_org_id() is still null during setup)
CREATE POLICY "users_read_self" ON users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "org_read_via_user" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.organization_id = organizations.id
    )
  );

-- Replace JWT-only org checks with auth_org_id() helper
DROP POLICY IF EXISTS "org_read" ON organizations;
CREATE POLICY "org_read" ON organizations FOR SELECT
  USING (id = public.auth_org_id());
DROP POLICY IF EXISTS "org_update" ON organizations;
CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (id = public.auth_org_id());

DROP POLICY IF EXISTS "branch_isolation" ON branches;
CREATE POLICY "branch_isolation" ON branches
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "users_isolation" ON users;
CREATE POLICY "users_isolation" ON users
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "categories_isolation" ON categories;
CREATE POLICY "categories_isolation" ON categories
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "products_isolation" ON products;
CREATE POLICY "products_isolation" ON products
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "suppliers_isolation" ON suppliers;
CREATE POLICY "suppliers_isolation" ON suppliers
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "purchases_isolation" ON purchases;
CREATE POLICY "purchases_isolation" ON purchases
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "purchase_items_isolation" ON purchase_items;
CREATE POLICY "purchase_items_isolation" ON purchase_items
  USING (purchase_id IN (
    SELECT id FROM purchases
    WHERE organization_id = public.auth_org_id()
  ));

DROP POLICY IF EXISTS "sessions_isolation" ON cash_sessions;
CREATE POLICY "sessions_isolation" ON cash_sessions
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "sales_isolation" ON sales;
CREATE POLICY "sales_isolation" ON sales
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "sale_items_isolation" ON sale_items;
CREATE POLICY "sale_items_isolation" ON sale_items
  USING (sale_id IN (
    SELECT id FROM sales
    WHERE organization_id = public.auth_org_id()
  ));

DROP POLICY IF EXISTS "payments_isolation" ON payments;
CREATE POLICY "payments_isolation" ON payments
  USING (sale_id IN (
    SELECT id FROM sales
    WHERE organization_id = public.auth_org_id()
  ));

DROP POLICY IF EXISTS "stock_movements_read" ON stock_movements;
CREATE POLICY "stock_movements_read" ON stock_movements FOR SELECT
  USING (organization_id = public.auth_org_id());
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT
  WITH CHECK (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "settings_isolation" ON settings;
CREATE POLICY "settings_isolation" ON settings
  USING (organization_id = public.auth_org_id());

DROP POLICY IF EXISTS "activity_logs_read" ON activity_logs;
CREATE POLICY "activity_logs_read" ON activity_logs FOR SELECT
  USING (organization_id = public.auth_org_id());
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT
  WITH CHECK (organization_id = public.auth_org_id());

-- Keep RPC stock functions aligned with auth_org_id()
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty - p_qty,
      updated_at = now()
  WHERE id = p_product_id
    AND track_stock = true
    AND organization_id = public.auth_org_id();
END;
$$;

CREATE OR REPLACE FUNCTION increment_stock(p_product_id uuid, p_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'increment_stock quantity must be positive';
  END IF;

  UPDATE products
  SET stock_qty = stock_qty + p_qty,
      updated_at = now()
  WHERE id = p_product_id
    AND track_stock = true
    AND organization_id = public.auth_org_id();
END;
$$;

CREATE OR REPLACE FUNCTION set_stock_qty(p_product_id uuid, p_new_qty numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty numeric;
  v_delta numeric;
BEGIN
  SELECT stock_qty INTO v_old_qty
  FROM products
  WHERE id = p_product_id
    AND track_stock = true
    AND organization_id = public.auth_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_delta := p_new_qty - v_old_qty;

  UPDATE products
  SET stock_qty = p_new_qty,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN v_delta;
END;
$$;
