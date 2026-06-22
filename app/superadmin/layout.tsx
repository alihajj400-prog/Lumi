import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Super-admin gate — server-side, runs before any child page renders.
// Only emails listed in SUPER_ADMIN_EMAILS (comma-separated env var) may enter.
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !allowed.includes(user.email?.toLowerCase() ?? '')) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1B2A4A] text-white px-6 py-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-lg tracking-tight">LUMI</span>
          <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
            Super Admin
          </span>
        </div>
        <span className="text-xs text-white/60">{user.email}</span>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
