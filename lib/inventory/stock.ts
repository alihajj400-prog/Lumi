import { createClient } from '@/lib/supabase/client'

export interface SaleStockItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price_usd: number
  unit_price_lbp: number
  discount_amount_usd: number
  line_total_usd: number
}

export interface SalePaymentRow {
  method: string
  amount_usd: number
  amount_lbp: number
  reference_number?: string | null
}

export interface CreatePosSaleParams {
  organizationId: string
  branchId: string
  cashSessionId: string
  cashierId: string
  saleNumber: string
  subtotalUsd: number
  discountAmountUsd: number
  taxAmountUsd: number
  totalUsd: number
  totalLbp: number
  exchangeRateUsed: number
  items: SaleStockItem[]
  payments: SalePaymentRow[]
}

/** Atomically create a sale and apply stock deductions via database RPC. */
export async function createPosSaleWithStock(params: CreatePosSaleParams) {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('create_pos_sale', {
    p_organization_id: params.organizationId,
    p_branch_id: params.branchId,
    p_cash_session_id: params.cashSessionId,
    p_cashier_id: params.cashierId,
    p_sale_number: params.saleNumber,
    p_subtotal_usd: params.subtotalUsd,
    p_discount_amount_usd: params.discountAmountUsd,
    p_tax_amount_usd: params.taxAmountUsd,
    p_total_usd: params.totalUsd,
    p_total_lbp: params.totalLbp,
    p_exchange_rate_used: params.exchangeRateUsed,
    p_items: params.items,
    p_payments: params.payments,
  })

  if (error) throw error
  return data as { id: string; sale_number: string; created_at: string }
}

/** Void a completed sale and restore stock via database RPC. */
export async function voidSaleWithStockRestore(saleId: string, voidReason: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('void_sale', {
    p_sale_id: saleId,
    p_void_reason: voidReason.trim(),
  })
  if (error) throw error
}

/** Atomically add stock (purchases, returns). */
export async function incrementStock(productId: string, qty: number) {
  if (qty <= 0) throw new Error('Quantity must be positive')
  const supabase = createClient()
  const { error } = await supabase.rpc('increment_stock', {
    p_product_id: productId,
    p_qty: qty,
  })
  if (error) throw error
}

/** Atomically remove stock (manual adjustments). */
export async function decrementStock(productId: string, qty: number) {
  if (qty <= 0) throw new Error('Quantity must be positive')
  const supabase = createClient()
  const { error } = await supabase.rpc('decrement_stock', {
    p_product_id: productId,
    p_qty: qty,
  })
  if (error) throw error
}

/** Atomically set stock to an exact quantity; returns signed delta. */
export async function setStockQty(productId: string, newQty: number) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('set_stock_qty', {
    p_product_id: productId,
    p_new_qty: newQty,
  })
  if (error) throw error
  return (data ?? 0) as number
}
