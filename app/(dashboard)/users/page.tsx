import { createClient } from '@/lib/supabase/server'
import { UsersClient } from './users-client'

export default async function UsersPage() {
  const supabase = await createClient()

  const [usersResult, branchesResult] = await Promise.all([
    supabase
      .from('users')
      .select('*, branches(id, name)')
      .order('full_name'),
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true),
  ])

  return (
    <UsersClient
      initialUsers={(usersResult.data ?? []) as any[]}
      branches={(branchesResult.data ?? []) as any[]}
    />
  )
}
