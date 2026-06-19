-- LUMI Dev Seed
-- Run AFTER 001_initial_schema.sql
-- Creates one org + branch + settings.
-- After running: create a user in Supabase Auth dashboard, then run 003_seed_user.sql with that user's UUID.

INSERT INTO organizations (id, name, slug, exchange_rate, vat_enabled, vat_rate, default_currency)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Demo Business',
  'demo-business',
  90000,
  false,
  11.00,
  'USD'
) ON CONFLICT DO NOTHING;

INSERT INTO branches (id, organization_id, name, address, phone)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Main Branch',
  'Beirut, Lebanon',
  '+961 1 000000'
) ON CONFLICT DO NOTHING;

INSERT INTO settings (organization_id, currency_display, receipt_language, invoice_prefix, po_prefix)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'both',
  'en',
  'INV',
  'PO'
) ON CONFLICT DO NOTHING;

-- Sample categories
INSERT INTO categories (organization_id, name, color, display_order) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Food',      '#E8A427', 1),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Drinks',    '#1B2A4A', 2),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Desserts',  '#D97706', 3),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Packaged',  '#059669', 4)
ON CONFLICT DO NOTHING;
