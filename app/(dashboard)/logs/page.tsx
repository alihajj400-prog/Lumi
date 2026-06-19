import { createClient } from '@/lib/supabase/server'
import { LogsClient } from './logs-client'

export default async function LogsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('activity_logs')
    .select('*, actor:users!user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  return <LogsClient initialLogs={(data ?? []) as any[]} />
}
