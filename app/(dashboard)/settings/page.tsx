import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [orgResult, settingsResult] = await Promise.all([
    supabase.from('organizations').select('*').single(),
    supabase.from('settings').select('*').single(),
  ])

  return (
    <SettingsClient
      org={(orgResult.data ?? {}) as any}
      settings={(settingsResult.data ?? {}) as any}
    />
  )
}
