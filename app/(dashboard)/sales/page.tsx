import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './sales-client'

export default async function SalesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('sales')
    .select('*, payments(method, amount_usd, amount_lbp), sale_items(id, product_name, quantity, unit_price_usd, line_total_usd)')
    .order('created_at', { ascending: false })
    .limit(300)

  return <SalesClient initialSales={(data ?? []) as any[]} />
}
