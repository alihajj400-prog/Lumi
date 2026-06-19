import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { UserProfile, Organization, Branch, OrgSettings } from '@/lib/supabase/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [userResult, orgResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('organizations').select('*').limit(1).single(),
  ])

  if (!userResult.data) {
    console.error('Dashboard layout: user row not found', userResult.error)
    redirect('/login')
  }
  if (!orgResult.data) {
    console.error('Dashboard layout: org not found', orgResult.error)
    redirect('/login')
  }

  const profile = userResult.data as unknown as UserProfile
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
      branch={branchResult.data as unknown as Branch}
      settings={settingsResult.data as unknown as OrgSettings}
    >
      {children}
    </DashboardShell>
  )
}
