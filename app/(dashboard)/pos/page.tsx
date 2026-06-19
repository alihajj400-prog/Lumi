import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PosClient } from './pos-client'

export default async function PosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [productsResult, categoriesResult, sessionResult, userResult, orgResult] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, name_ar, sku, barcode, category_id, unit, price_usd, price_lbp, stock_qty, track_stock, image_url, is_active')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('categories')
        .select('id, name, color, icon')
        .order('display_order', { ascending: true }),
      supabase
        .from('cash_sessions')
        .select('id, opened_at, opening_cash_usd, opening_cash_lbp')
        .eq('cashier_id', user.id)
        .eq('status', 'open')
        .maybeSingle(),
      supabase
        .from('users')
        .select('id, full_name, role, branch_id, organization_id')
        .eq('id', user.id)
        .single(),
      supabase
        .from('organizations')
        .select('id, name, exchange_rate, vat_enabled, vat_rate, default_currency')
        .single(),
    ])

  const products = (productsResult.data ?? []) as any[]
  const categories = (categoriesResult.data ?? []) as any[]
  const activeSession = sessionResult.data as any | null
  const userProfile = userResult.data as any
  const org = orgResult.data as any

  return (
    <PosClient
      products={products}
      categories={categories}
      activeSession={activeSession}
      userId={user.id}
      userProfile={userProfile}
      org={org}
    />
  )
}
