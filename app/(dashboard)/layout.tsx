import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { SetupRequired } from '@/components/layout/setup-required'
import type { UserProfile, Organization, Branch, OrgSettings } from '@/lib/supabase/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <SetupRequired
        orgError="Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables."
      />
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userResult = await supabase.from('users').select('*').eq('id', user.id).single()

  if (!userResult.data) {
    console.error('Dashboard layout user missing:', userResult.error)
    return (
      <SetupRequired
        userError={userResult.error?.message ?? 'No user profile row found for this login'}
        orgError={
          userResult.error?.code === 'PGRST116'
            ? `No row in users for auth id ${user.id}. Add this UUID to the users table.`
            : null
        }
      />
    )
  }

  const profile = userResult.data as unknown as UserProfile

  const orgResult = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single()

  if (!orgResult.data) {
    console.error('Dashboard layout org missing:', orgResult.error)
    return (
      <SetupRequired
        orgError={
          orgResult.error?.message ??
          `No organization found for id ${profile.organization_id}. Run 002_seed_dev.sql or sign out and sign in again so org_id is in your JWT.`
        }
      />
    )
  }

  const organization = orgResult.data as unknown as Organization

  const [branchResult, settingsResult] = await Promise.all([
    profile.branch_id
      ? supabase.from('branches').select('*').eq('id', profile.branch_id).single()
      : supabase.from('branches').select('*').eq('organization_id', organization.id).limit(1).single(),
    supabase.from('settings').select('*').eq('organization_id', organization.id).single(),
  ])

  return (
    <DashboardShell
      user={profile}
      organization={organization}
      branch={branchResult.data as unknown as Branch | null}
      settings={settingsResult.data as unknown as OrgSettings | null}
    >
      {children}
    </DashboardShell>
  )
}
