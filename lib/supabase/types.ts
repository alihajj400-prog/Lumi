export type UserRole = 'admin' | 'manager' | 'cashier' | 'stock_clerk' | 'accountant'
export type SubscriptionPlan = 'starter' | 'growth' | 'pro' | 'enterprise'
export type SaleStatus = 'completed' | 'voided' | 'refunded' | 'held'
export type PurchaseStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod =
  | 'cash_usd'
  | 'cash_lbp'
  | 'card'
  | 'whish'
  | 'omt'
  | 'bob_finance'
  | 'bank_transfer'
  | 'other'
export type MovementType =
  | 'sale'
  | 'return'
  | 'purchase'
  | 'adjustment'
  | 'waste'
  | 'damage'
  | 'opening'
export type CashSessionStatus = 'open' | 'closed'

export interface Organization {
  id: string
  name: string
  name_ar: string | null
  slug: string
  subscription_plan: SubscriptionPlan
  exchange_rate: number
  vat_enabled: boolean
  vat_rate: number
  default_currency: 'USD' | 'LBP'
  logo_url: string | null
  created_at: string
}

export interface Branch {
  id: string
  organization_id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface UserProfile {
  id: string
  organization_id: string
  branch_id: string | null
  full_name: string
  role: UserRole
  pin_hash: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  organization_id: string
  name: string
  name_ar: string | null
  color: string | null
  icon: string | null
  display_order: number
  created_at: string
}

export interface Product {
  id: string
  organization_id: string
  branch_id: string | null
  category_id: string | null
  name: string
  name_ar: string | null
  sku: string
  barcode: string | null
  unit: string
  price_usd: number
  price_lbp: number
  cost_usd: number
  tax_rate: number
  is_composite: boolean
  track_stock: boolean
  stock_qty: number
  reorder_level: number
  expiry_date: string | null
  image_url: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  categories?: Category
}

export interface Supplier {
  id: string
  organization_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms: string | null
  currency: 'USD' | 'LBP'
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  created_at: string
}

export interface Purchase {
  id: string
  organization_id: string
  branch_id: string
  supplier_id: string
  po_number: string
  status: PurchaseStatus
  ordered_at: string | null
  expected_at: string | null
  received_at: string | null
  invoice_number: string | null
  invoice_url: string | null
  subtotal_usd: number
  total_usd: number
  amount_paid_usd: number
  payment_status: PaymentStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  suppliers?: Supplier
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  ordered_qty: number
  received_qty: number
  unit_cost_usd: number
  total_cost_usd: number
  products?: Product
}

export interface Sale {
  id: string
  organization_id: string
  branch_id: string
  cash_session_id: string
  cashier_id: string
  customer_id: string | null
  sale_number: string
  status: SaleStatus
  subtotal_usd: number
  discount_amount_usd: number
  tax_amount_usd: number
  total_usd: number
  total_lbp: number
  exchange_rate_used: number
  is_return: boolean
  original_sale_id: string | null
  void_reason: string | null
  created_at: string
  users?: { full_name: string }
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price_usd: number
  unit_price_lbp: number
  discount_amount_usd: number
  line_total_usd: number
}

export interface Payment {
  id: string
  sale_id: string
  method: PaymentMethod
  amount_usd: number
  amount_lbp: number
  reference_number: string | null
  notes: string | null
  created_at: string
}

export interface CashSession {
  id: string
  organization_id: string
  branch_id: string
  cashier_id: string
  opened_at: string
  closed_at: string | null
  opening_cash_usd: number
  opening_cash_lbp: number
  closing_cash_usd: number | null
  expected_cash_usd: number | null
  difference_usd: number | null
  status: CashSessionStatus
}

export interface StockMovement {
  id: string
  organization_id: string
  branch_id: string
  product_id: string
  movement_type: MovementType
  quantity: number
  unit_cost_usd: number | null
  reference_id: string | null
  reference_type: string | null
  reason: string | null
  performed_by: string
  created_at: string
  products?: { name: string; sku: string }
  users?: { full_name: string }
}

export interface OrgSettings {
  id: string
  organization_id: string
  currency_display: 'usd' | 'lbp' | 'both'
  receipt_language: 'en' | 'ar' | 'both'
  receipt_header: string | null
  receipt_footer: string
  invoice_prefix: string
  po_prefix: string
  low_stock_alert_days: number
  expiry_alert_days: number
  fiscal_year_start: number
  updated_at: string
}

export interface ActivityLog {
  id: string
  organization_id: string
  user_id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  users?: { full_name: string }
}

// Generic Supabase Database type used by createClient
export type Database = {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      branches: { Row: Branch; Insert: Partial<Branch>; Update: Partial<Branch> }
      users: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> }
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> }
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> }
      suppliers: { Row: Supplier; Insert: Partial<Supplier>; Update: Partial<Supplier> }
      purchases: { Row: Purchase; Insert: Partial<Purchase>; Update: Partial<Purchase> }
      purchase_items: { Row: PurchaseItem; Insert: Partial<PurchaseItem>; Update: Partial<PurchaseItem> }
      sales: { Row: Sale; Insert: Partial<Sale>; Update: Partial<Sale> }
      sale_items: { Row: SaleItem; Insert: Partial<SaleItem>; Update: Partial<SaleItem> }
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> }
      cash_sessions: { Row: CashSession; Insert: Partial<CashSession>; Update: Partial<CashSession> }
      stock_movements: { Row: StockMovement; Insert: Partial<StockMovement>; Update: Partial<StockMovement> }
      settings: { Row: OrgSettings; Insert: Partial<OrgSettings>; Update: Partial<OrgSettings> }
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
