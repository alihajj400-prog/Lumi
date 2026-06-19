import { createClient } from '@/lib/supabase/server'
import { PurchasesClient } from './purchases-client'

export default async function PurchasesPage() {
  const supabase = await createClient()

  const [purchasesResult, suppliersResult, productsResult, userResult] = await Promise.all([
    supabase
      .from('purchases')
      .select('*, suppliers(id, name), purchase_items(id, product_id, ordered_qty, received_qty, unit_cost_usd, total_cost_usd, products(id, name, sku, unit))')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('suppliers')
      .select('id, name, currency')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, unit, cost_usd, price_usd, track_stock')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name'),
    supabase.auth.getUser(),
  ])

  return (
    <PurchasesClient
      initialPurchases={(purchasesResult.data ?? []) as any[]}
      suppliers={(suppliersResult.data ?? []) as any[]}
      products={(productsResult.data ?? []) as any[]}
      userId={userResult.data.user?.id ?? ''}
    />
  )
}
