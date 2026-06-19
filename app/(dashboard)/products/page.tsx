import { createClient } from '@/lib/supabase/server'
import { ProductsClient } from './products-client'

export default async function ProductsPage() {
  const supabase = await createClient()

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(id, name, color)')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, color')
      .order('display_order', { ascending: true }),
  ])

  return (
    <ProductsClient
      initialProducts={(productsResult.data ?? []) as any[]}
      categories={(categoriesResult.data ?? []) as any[]}
    />
  )
}
