import { createClient } from '@/lib/supabase/server'
import { SuppliersClient } from './suppliers-client'

export default async function SuppliersPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('suppliers')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return <SuppliersClient initialSuppliers={(data ?? []) as any[]} />
}
