'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { formatUsd } from '@/lib/currency'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  AlertTriangle,
  Loader2,
  CreditCard,
  History,
  Pencil,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  balance_usd: number
  credit_limit_usd: number
  notes: string | null
  created_at: string
}

interface Transaction {
  id: string
  type: string
  amount_usd: number
  note: string | null
  created_at: string
}

const TX_LABELS: Record<string, string> = {
  charge: 'Charged to account',
  payment: 'Payment received',
  adjustment: 'Manual adjustment',
}

export function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const { user, organization } = useAuthStore()
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'balance' | 'clear'>('all')

  // Add/edit dialog
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formLimit, setFormLimit] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Account sheet (history + record payment)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter(c => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      const matchFilter =
        filter === 'all' ||
        (filter === 'balance' && c.balance_usd > 0) ||
        (filter === 'clear' && c.balance_usd === 0)
      return matchSearch && matchFilter
    })
  }, [customers, search, filter])

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.balance_usd), 0)

  const openAdd = () => {
    setEditTarget(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormLimit('')
    setFormNotes('')
    setShowForm(true)
  }

  const openEdit = (c: Customer) => {
    setEditTarget(c)
    setFormName(c.name)
    setFormPhone(c.phone ?? '')
    setFormEmail(c.email ?? '')
    setFormLimit(c.credit_limit_usd > 0 ? (c.credit_limit_usd / 100).toFixed(2) : '')
    setFormNotes(c.notes ?? '')
    setShowForm(true)
  }

  const handleSaveCustomer = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return }
    setFormLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        credit_limit_usd: formLimit ? Math.round(parseFloat(formLimit) * 100) : 0,
        notes: formNotes.trim() || null,
      }
      if (editTarget) {
        const { data, error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editTarget.id)
          .select()
          .single()
        if (error) throw error
        setCustomers(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...data } : c))
        toast.success('Customer updated')
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert({ ...payload, organization_id: organization?.id })
          .select()
          .single()
        if (error) throw error
        setCustomers(prev => [data as Customer, ...prev])
        toast.success('Customer added')
      }
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save customer')
    } finally {
      setFormLoading(false)
    }
  }

  const openAccount = async (c: Customer) => {
    setViewCustomer(c)
    setPayAmount('')
    setPayNote('')
    setTxLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customer_transactions')
        .select('id, type, amount_usd, note, created_at')
        .eq('customer_id', c.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setTransactions((data ?? []) as Transaction[])
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setTxLoading(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!viewCustomer || !user || !organization) return
    const amount = Math.round(parseFloat(payAmount || '0') * 100)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    setPayLoading(true)
    try {
      const supabase = createClient()
      const { error: txError } = await supabase
        .from('customer_transactions')
        .insert({
          organization_id: organization.id,
          customer_id: viewCustomer.id,
          type: 'payment',
          amount_usd: amount,
          note: payNote.trim() || null,
          created_by: user.id,
        })
      if (txError) throw txError

      const newBalance = viewCustomer.balance_usd - amount
      const { error: balError } = await supabase
        .from('customers')
        .update({ balance_usd: newBalance })
        .eq('id', viewCustomer.id)
      if (balError) throw balError

      const updated = { ...viewCustomer, balance_usd: newBalance }
      setViewCustomer(updated)
      setCustomers(prev => prev.map(c => c.id === viewCustomer.id ? updated : c))
      setTransactions(prev => [{
        id: crypto.randomUUID(),
        type: 'payment',
        amount_usd: amount,
        note: payNote.trim() || null,
        created_at: new Date().toISOString(),
      }, ...prev])
      setPayAmount('')
      setPayNote('')
      toast.success('Payment recorded')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to record payment')
    } finally {
      setPayLoading(false)
    }
  }

  const balanceBadge = (c: Customer) => {
    if (c.balance_usd <= 0) return <Badge className="bg-green-100 text-green-700 border-green-200">Clear</Badge>
    const overLimit = c.credit_limit_usd > 0 && c.balance_usd > c.credit_limit_usd
    return (
      <Badge className={`${overLimit ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
        {overLimit && <AlertTriangle className="h-3 w-3 mr-1" />}
        {formatUsd(c.balance_usd)} owed
      </Badge>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} accounts · {formatUsd(totalOutstanding)} total outstanding</p>
        </div>
        <Button onClick={openAdd} className="bg-[#1B2A4A] text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'With Balance', value: customers.filter(c => c.balance_usd > 0).length },
          { label: 'Outstanding', value: formatUsd(totalOutstanding) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Name, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-52"
          />
        </div>
        {(['all', 'balance', 'clear'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#1B2A4A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'balance' ? 'Has Balance' : 'Clear'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">Balance</th>
              <th className="text-left px-4 py-3">Credit Limit</th>
              <th className="text-left px-4 py-3">Since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No customers found
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  {c.notes && <p className="text-xs text-gray-400 truncate max-w-[180px]">{c.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</div>}
                </td>
                <td className="px-4 py-3">{balanceBadge(c)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.credit_limit_usd > 0 ? formatUsd(c.credit_limit_usd) : <span className="text-gray-300">No limit</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => openAccount(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <History className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+961 xx xxx xxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Credit Limit (USD) <span className="text-gray-400 font-normal">— leave blank for no limit</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input type="number" min={0} step={0.01} value={formLimit} onChange={e => setFormLimit(e.target.value)} placeholder="0.00" className="pl-7" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Address, delivery info..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={formLoading}>Cancel</Button>
            <Button onClick={handleSaveCustomer} disabled={formLoading || !formName.trim()} className="bg-[#1B2A4A] text-white">
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editTarget ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Sheet */}
      <Sheet open={!!viewCustomer} onOpenChange={open => !open && setViewCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{viewCustomer?.name}</SheetTitle>
          </SheetHeader>

          {viewCustomer && (
            <div className="flex-1 overflow-y-auto space-y-5 mt-4 pb-6">
              {/* Balance card */}
              <div className={`rounded-xl p-4 ${viewCustomer.balance_usd > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <p className="text-xs font-medium text-gray-500 mb-1">OUTSTANDING BALANCE</p>
                <p className={`text-3xl font-bold ${viewCustomer.balance_usd > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {formatUsd(viewCustomer.balance_usd)}
                </p>
                {viewCustomer.credit_limit_usd > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Limit: {formatUsd(viewCustomer.credit_limit_usd)}</p>
                )}
              </div>

              {/* Record payment */}
              {viewCustomer.balance_usd > 0 && (
                <div className="border rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Record Payment
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Amount"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="pl-7 h-9"
                      />
                    </div>
                    <Input
                      placeholder="Note (optional)"
                      value={payNote}
                      onChange={e => setPayNote(e.target.value)}
                      className="flex-1 h-9"
                    />
                  </div>
                  <Button
                    onClick={handleRecordPayment}
                    disabled={payLoading || !payAmount}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-9"
                  >
                    {payLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Record Payment
                  </Button>
                </div>
              )}

              <Separator />

              {/* Transaction history */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-3">TRANSACTION HISTORY</p>
                {txLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{TX_LABELS[tx.type] ?? tx.type}</p>
                          {tx.note && <p className="text-xs text-gray-400">{tx.note}</p>}
                          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${tx.type === 'payment' ? 'text-green-600' : 'text-amber-600'}`}>
                          {tx.type === 'payment' ? '-' : '+'}{formatUsd(tx.amount_usd)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
