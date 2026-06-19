import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './inventory-client'

export default async function InventoryPage() {
  const supabase = await createClient()

  const [productsResult, movementsResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, name_ar, sku, barcode, category_id, unit, stock_qty, reorder_level, cost_usd, price_usd, track_stock, expiry_date, image_url, is_active, categories(id, name, color)')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('stock_movements')
      .select('id, product_id, movement_type, quantity, reason, reference_type, reference_id, performed_by, created_at, products(name, sku), users(full_name)')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <InventoryClient
      initialProducts={(productsResult.data ?? []) as any[]}
      initialMovements={(movementsResult.data ?? []) as any[]}
    />
  )
}
