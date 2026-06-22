import { createClient } from '@/lib/supabase/server'
import { CustomersClient } from './customers-client'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, email, balance_usd, credit_limit_usd, notes, created_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return <CustomersClient initialCustomers={(customers ?? []) as any[]} />
}
