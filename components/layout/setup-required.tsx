'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

interface Props {
  userError?: string | null
  orgError?: string | null
}

export function SetupRequired({ userError, orgError }: Props) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle>Account setup required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You are signed in, but the app could not load your organization profile.
            This usually means one of the following:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your user is missing from the <code className="text-xs">users</code> table in Supabase</li>
            <li>The Supabase Auth custom access token hook for <code className="text-xs">org_id</code> is not enabled</li>
            <li>Row Level Security is blocking your organization data</li>
          </ul>
          {(userError || orgError) && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 space-y-1">
              {userError && <p>User profile: {userError}</p>}
              {orgError && <p>Organization: {orgError}</p>}
            </div>
          )}
          <p className="text-xs">
            If your hook is already enabled, sign out and sign in again so a fresh JWT is issued with{' '}
            <code>org_id</code>. Also confirm the <code>organizations</code> row exists for your user&apos;s{' '}
            <code>organization_id</code>.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
