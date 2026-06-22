'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const PLANS = [
  { value: 'starter', label: 'Starter — 1 branch, up to 5 users' },
  { value: 'growth', label: 'Growth — up to 3 branches, 15 users' },
  { value: 'pro', label: 'Pro — unlimited branches & users' },
  { value: 'enterprise', label: 'Enterprise — custom' },
]

export default function ProvisionPage() {
  const router = useRouter()

  const [orgName, setOrgName] = useState('')
  const [plan, setPlan] = useState('starter')
  const [branchName, setBranchName] = useState('')
  const [adminFullName, setAdminFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [exchangeRate, setExchangeRate] = useState('90000')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)

  const handleProvision = async () => {
    setError(null)
    if (!orgName.trim() || !adminEmail.trim() || !adminPassword.trim() || !adminFullName.trim()) {
      setError('Fill in all required fields')
      return
    }
    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          plan,
          branchName: branchName.trim() || 'Main Branch',
          adminFullName: adminFullName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPassword,
          exchangeRate: parseInt(exchangeRate) || 90000,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Provision failed')
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Client Provisioned</h2>
          <p className="text-gray-500 text-sm">The account is ready. Share these credentials with the client.</p>

          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">Organization</span>
              <span className="font-semibold text-gray-900">{result.org.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Branch</span>
              <span className="font-semibold text-gray-900">{result.branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Login URL</span>
              <span className="font-semibold text-gray-900">lumi-phi-nine.vercel.app/login</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email</span>
              <span className="font-semibold text-gray-900">{result.adminEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Password</span>
              <span className="font-semibold text-gray-900">{adminPassword}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const text = `LUMI Login\nURL: lumi-phi-nine.vercel.app/login\nEmail: ${result.adminEmail}\nPassword: ${adminPassword}`
                navigator.clipboard.writeText(text)
              }}
            >
              Copy Credentials
            </Button>
            <Button
              className="flex-1 bg-[#1B2A4A] text-white"
              onClick={() => router.push('/superadmin')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/superadmin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Provision New Client</h1>
          <p className="text-sm text-gray-500">Creates the organization, branch, and admin account in one step.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {/* Organization */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Organization</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Business Name <span className="text-red-500">*</span></Label>
              <Input
                autoFocus
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Café Rawda"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Branch Name</Label>
                <Input
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  placeholder="Main Branch"
                />
              </div>
              <div className="space-y-1.5">
                <Label>USD/LBP Rate</Label>
                <Input
                  type="number"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  placeholder="90000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={v => setPlan(v ?? 'starter')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Admin account */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Admin Account</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input
                value={adminFullName}
                onChange={e => setAdminFullName(e.target.value)}
                placeholder="Owner / Manager name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="owner@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary Password <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
              <p className="text-xs text-gray-400">The client should change this after first login.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <Button
          onClick={handleProvision}
          disabled={loading}
          className="w-full bg-[#1B2A4A] hover:bg-[#243659] text-white h-11 font-semibold"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Provision Client
        </Button>
      </div>
    </div>
  )
}
