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

CREATE OR REPLACE FUNCTION create_pos_sale(
  p_organization_id uuid,
  p_branch_id uuid,
  p_cash_session_id uuid,
  p_cashier_id uuid,
  p_sale_number text,
  p_subtotal_usd integer,
  p_discount_amount_usd integer,
  p_tax_amount_usd integer,
  p_total_usd integer,
  p_total_lbp integer,
  p_exchange_rate_used integer,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_created_at timestamptz;
BEGIN
  IF p_organization_id IS DISTINCT FROM public.auth_org_id() THEN
    RAISE EXCEPTION 'Unauthorized organization';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale must have at least one item';
  END IF;

  INSERT INTO sales (
    organization_id, branch_id, cash_session_id, cashier_id,
    sale_number, status, subtotal_usd, discount_amount_usd, tax_amount_usd,
    total_usd, total_lbp, exchange_rate_used, is_return
  ) VALUES (
    p_organization_id, p_branch_id, p_cash_session_id, p_cashier_id,
    p_sale_number, 'completed', p_subtotal_usd, p_discount_amount_usd, p_tax_amount_usd,
    p_total_usd, p_total_lbp, p_exchange_rate_used, false
  )
  RETURNING id, created_at INTO v_sale_id, v_created_at;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be positive';
    END IF;

    INSERT INTO sale_items (
      sale_id, product_id, product_name, quantity,
      unit_price_usd, unit_price_lbp, discount_amount_usd, line_total_usd
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_item->>'product_name',
      v_qty,
      (v_item->>'unit_price_usd')::integer,
      (v_item->>'unit_price_lbp')::integer,
      COALESCE((v_item->>'discount_amount_usd')::integer, 0),
      (v_item->>'line_total_usd')::integer
    );

    UPDATE products
    SET stock_qty = stock_qty - v_qty,
        updated_at = now()
    WHERE id = v_product_id
      AND track_stock = true
      AND organization_id = p_organization_id;

    INSERT INTO stock_movements (
      organization_id, branch_id, product_id, movement_type, quantity,
      reference_id, reference_type, reason, performed_by
    ) VALUES (
      p_organization_id, p_branch_id, v_product_id, 'sale', -v_qty,
      v_sale_id, 'sale', 'Sale ' || p_sale_number, p_cashier_id
    );
  END LOOP;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    IF COALESCE((v_payment->>'amount_usd')::integer, 0) > 0
       OR COALESCE((v_payment->>'amount_lbp')::integer, 0) > 0 THEN
      INSERT INTO payments (sale_id, method, amount_usd, amount_lbp, reference_number)
      VALUES (
        v_sale_id,
        v_payment->>'method',
        COALESCE((v_payment->>'amount_usd')::integer, 0),
        COALESCE((v_payment->>'amount_lbp')::integer, 0),
        NULLIF(v_payment->>'reference_number', '')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_sale_id,
    'sale_number', p_sale_number,
    'created_at', v_created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION void_sale(p_sale_id uuid, p_void_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_item sale_items%ROWTYPE;
  v_track_stock boolean;
BEGIN
  IF COALESCE(trim(p_void_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
    AND organization_id = public.auth_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be voided';
  END IF;

  UPDATE sales
  SET status = 'voided',
      void_reason = trim(p_void_reason)
  WHERE id = p_sale_id;

  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    SELECT track_stock INTO v_track_stock
    FROM products
    WHERE id = v_item.product_id;

    IF COALESCE(v_track_stock, false) THEN
      UPDATE products
      SET stock_qty = stock_qty + v_item.quantity,
          updated_at = now()
      WHERE id = v_item.product_id;

      INSERT INTO stock_movements (
        organization_id, branch_id, product_id, movement_type, quantity,
        reference_id, reference_type, reason, performed_by
      ) VALUES (
        v_sale.organization_id, v_sale.branch_id, v_item.product_id, 'return', v_item.quantity,
        p_sale_id, 'sale', 'Void sale ' || v_sale.sale_number || ': ' || trim(p_void_reason),
        COALESCE(auth.uid(), v_sale.cashier_id)
      );
    END IF;
  END LOOP;
END;
$$;
