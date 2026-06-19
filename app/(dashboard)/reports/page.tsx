import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const supabase = await createClient()

  // Last 30 days of sales + items + payments
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [salesResult, productsResult] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total_usd, total_lbp, status, created_at, sale_items(product_id, product_name, quantity, line_total_usd), payments(method, amount_usd, amount_lbp)')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),
    supabase
      .from('products')
      .select('id, name, sku, stock_qty, reorder_level, track_stock')
      .is('deleted_at', null)
      .eq('is_active', true),
  ])

  return (
    <ReportsClient
      sales={(salesResult.data ?? []) as any[]}
      products={(productsResult.data ?? []) as any[]}
    />
  )
}
