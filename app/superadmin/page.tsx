import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { formatUsd } from '@/lib/currency'

// Uses service role to read across all orgs (bypasses RLS).
async function getAllOrgs() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [orgsRes, usersRes, branchesRes, salesRes] = await Promise.all([
    admin.from('organizations').select('id, name, slug, subscription_plan, created_at').order('created_at', { ascending: false }),
    admin.from('users').select('organization_id, role'),
    admin.from('branches').select('organization_id, is_active'),
    admin.from('sales').select('organization_id, total_usd, status').eq('status', 'completed'),
  ])

  const orgs = orgsRes.data ?? []
  const users = usersRes.data ?? []
  const branches = branchesRes.data ?? []
  const sales = salesRes.data ?? []

  return orgs.map(org => ({
    ...org,
    userCount: users.filter((u: any) => u.organization_id === org.id).length,
    branchCount: branches.filter((b: any) => b.organization_id === org.id && b.is_active).length,
    totalRevenue: sales
      .filter((s: any) => s.organization_id === org.id)
      .reduce((sum: number, s: any) => sum + (s.total_usd ?? 0), 0),
    saleCount: sales.filter((s: any) => s.organization_id === org.id).length,
  }))
}

const PLAN_STYLES: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-600',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
}

export default async function SuperAdminPage() {
  const orgs = await getAllOrgs()

  const totalRevenue = orgs.reduce((s, o) => s + o.totalRevenue, 0)
  const totalUsers = orgs.reduce((s, o) => s + o.userCount, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Organizations</h1>
          <p className="text-sm text-gray-500 mt-1">{orgs.length} clients</p>
        </div>
        <Link
          href="/superadmin/new"
          className="bg-[#1B2A4A] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#243659] transition-colors"
        >
          + Provision New Client
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Organizations', value: orgs.length },
          { label: 'Total Users', value: totalUsers },
          { label: 'Total Revenue', value: formatUsd(totalRevenue) },
          { label: 'Total Sales', value: orgs.reduce((s, o) => s + o.saleCount, 0) },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Org table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
              <th className="text-left px-4 py-3">Organization</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-right px-4 py-3">Branches</th>
              <th className="text-right px-4 py-3">Users</th>
              <th className="text-right px-4 py-3">Sales</th>
              <th className="text-right px-4 py-3">Revenue</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  No organizations yet — provision your first client.
                </td>
              </tr>
            ) : orgs.map(org => (
              <tr key={org.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{org.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{org.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_STYLES[org.subscription_plan] ?? 'bg-gray-100 text-gray-600'}`}>
                    {org.subscription_plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{org.branchCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{org.userCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{org.saleCount}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatUsd(org.totalRevenue)}</td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
