-- Stock management RPCs: atomic updates and sale void/complete helpers.
-- Run in Supabase SQL editor after 004_pos_functions.sql.

-- Atomically increment stock_qty for a product (purchases, voids, returns).
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
    AND organization_id = (auth.jwt() ->> 'org_id')::uuid;
END;
$$;

-- Atomically set stock_qty; returns the signed delta for movement logging.
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
    AND organization_id = (auth.jwt() ->> 'org_id')::uuid
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

-- Create a completed POS sale with items, payments, and stock movements in one transaction.
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
  IF p_organization_id IS DISTINCT FROM (auth.jwt() ->> 'org_id')::uuid THEN
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

-- Void a completed sale and restore stock atomically.
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
    AND organization_id = (auth.jwt() ->> 'org_id')::uuid
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

GRANT EXECUTE ON FUNCTION increment_stock(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION set_stock_qty(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION create_pos_sale(uuid, uuid, uuid, uuid, text, integer, integer, integer, integer, integer, integer, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION void_sale(uuid, text) TO authenticated;
