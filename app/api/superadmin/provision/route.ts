import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// This route uses the service role key to:
// 1. Create an auth user for the client's admin
// 2. Create the organization, branch, org_settings, and users profile
// It is protected by super-admin email check — never expose service role to the browser.

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function POST(req: NextRequest) {
  // 1. Verify caller is a super admin
  const allowed = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller || !allowed.includes(caller.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Parse body
  const body = await req.json()
  const {
    orgName,
    plan = 'starter',
    branchName,
    adminEmail,
    adminPassword,
    adminFullName,
    exchangeRate = 90000,
  } = body

  if (!orgName || !adminEmail || !adminPassword || !adminFullName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 3. Build service-role admin client (server-only, never reaches browser)
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }
  const admin = createAdminClient(serviceUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 4. Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })
    if (authErr) throw new Error(`Auth user: ${authErr.message}`)
    const authUserId = authData.user.id

    // 5. Create organization
    const slug = slugify(orgName) + '-' + Math.random().toString(36).slice(2, 6)
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        subscription_plan: plan,
        exchange_rate: exchangeRate,
      })
      .select()
      .single()
    if (orgErr) throw new Error(`Organization: ${orgErr.message}`)

    // 6. Create default branch
    const { data: branch, error: branchErr } = await admin
      .from('branches')
      .insert({
        organization_id: org.id,
        name: branchName || 'Main Branch',
        is_active: true,
      })
      .select()
      .single()
    if (branchErr) throw new Error(`Branch: ${branchErr.message}`)

    // 7. Create org_settings
    const { error: settingsErr } = await admin
      .from('org_settings')
      .insert({ organization_id: org.id })
    if (settingsErr) throw new Error(`Settings: ${settingsErr.message}`)

    // 8. Create users profile (admin role)
    const { error: userErr } = await admin
      .from('users')
      .insert({
        id: authUserId,
        organization_id: org.id,
        branch_id: branch.id,
        full_name: adminFullName,
        role: 'admin',
        is_active: true,
      })
    if (userErr) throw new Error(`User profile: ${userErr.message}`)

    return NextResponse.json({
      success: true,
      org: { id: org.id, name: org.name, slug },
      branch: { id: branch.id, name: branch.name },
      adminEmail,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
