import { createClient } from '@/lib/supabase/server'
import { CategoriesClient } from './categories-client'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true })

  return <CategoriesClient initialCategories={(data ?? []) as any[]} />
}
