-- Sprint 3: POS helper functions

-- Atomically decrement stock_qty for a product.
-- Only decrements if track_stock is true. Allows negative (cashier can oversell — stock_clerk reconciles).
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty - p_qty,
      updated_at = now()
  WHERE id = p_product_id
    AND track_stock = true
    AND organization_id = (auth.jwt() ->> 'org_id')::uuid;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION decrement_stock(uuid, numeric) TO authenticated;
