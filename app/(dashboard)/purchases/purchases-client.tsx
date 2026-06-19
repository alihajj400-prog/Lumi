'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatUsd } from '@/lib/currency'
import { formatDate } from '@/lib/format'
import { useAuthStore } from '@/lib/store/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Search,
  Eye,
  PackageCheck,
  CreditCard,
  Trash2,
  Loader2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PurchaseItem {
  id: string
  product_id: string
  ordered_qty: number
  received_qty: number
  unit_cost_usd: number
  total_cost_usd: number
  products: { id: string; name: string; sku: string; unit: string } | null
}

interface Purchase {
  id: string
  po_number: string
  supplier_id: string
  status: string
  payment_status: string
  ordered_at: string | null
  expected_at: string | null
  received_at: string | null
  invoice_number: string | null
  subtotal_usd: number
  total_usd: number
  amount_paid_usd: number
  notes: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
  purchase_items: PurchaseItem[]
}

interface Product {
  id: string
  name: string
  sku: string
  unit: string
  cost_usd: number
  track_stock: boolean
}

interface Supplier {
  id: string
  name: string
  currency: 'USD' | 'LBP'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generatePoNumber() {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900 + 100)
  return `PO-${datePart}-${rand}`
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  received: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-600 border-red-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
}

interface LineItem {
  product_id: string
  product_name: string
  sku: string
  unit: string
  ordered_qty: string
  unit_cost_usd: string
}

const emptyLine = (): LineItem => ({
  product_id: '',
  product_name: '',
  sku: '',
  unit: '',
  ordered_qty: '',
  unit_cost_usd: '',
})

// ─── Component ───────────────────────────────────────────────────────────────
interface Props {
  initialPurchases: Purchase[]
  suppliers: Supplier[]
  products: Product[]
  userId: string
}

export function PurchasesClient({ initialPurchases, suppliers, products, userId }: Props) {
  const router = useRouter()
  const { organization, branch } = useAuthStore()
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Create PO sheet
  const [createOpen, setCreateOpen] = useState(false)
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poOrderedAt, setPoOrderedAt] = useState('')
  const [poExpectedAt, setPoExpectedAt] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poLines, setPoLines] = useState<LineItem[]>([emptyLine()])
  const [poSaving, setPoSaving] = useState(false)

  // View / Receive sheet
  const [viewPo, setViewPo] = useState<Purchase | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({})
  const [receiveInvoice, setReceiveInvoice] = useState('')
  const [receiveSaving, setReceiveSaving] = useState(false)

  // Payment dialog
  const [payPo, setPayPo] = useState<Purchase | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  // Cancel dialog
  const [cancelPo, setCancelPo] = useState<Purchase | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // ─── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return purchases.filter(p => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        p.po_number.toLowerCase().includes(q) ||
        (p.suppliers?.name ?? '').toLowerCase().includes(q) ||
        (p.invoice_number ?? '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [purchases, search, statusFilter])

  // ─── Line item helpers ──────────────────────────────────────────────────────
  const updateLine = (idx: number, field: keyof LineItem, value: string) => {
    setPoLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        return prod
          ? { ...l, product_id: prod.id, product_name: prod.name, sku: prod.sku, unit: prod.unit, unit_cost_usd: (prod.cost_usd / 100).toFixed(2) }
          : { ...l, product_id: '' }
      }
      return { ...l, [field]: value }
    }))
  }

  const lineTotal = (l: LineItem) =>
    Math.round(parseFloat(l.ordered_qty || '0') * parseFloat(l.unit_cost_usd || '0') * 100)

  const poSubtotal = poLines.reduce((s, l) => s + lineTotal(l), 0)

  // ─── Create PO ─────────────────────────────────────────────────────────────
  const handleCreatePo = async () => {
    if (!poSupplierId) { toast.error('Select a supplier'); return }
    const validLines = poLines.filter(l => l.product_id && parseFloat(l.ordered_qty) > 0)
    if (validLines.length === 0) { toast.error('Add at least one line item'); return }
    if (!branch?.id || !organization?.id) { toast.error('No branch assigned'); return }

    setPoSaving(true)
    try {
      const supabase = createClient()
      const poNumber = generatePoNumber()

      const { data: po, error: poErr } = await supabase
        .from('purchases')
        .insert({
          organization_id: organization.id,
          branch_id: branch.id,
          supplier_id: poSupplierId,
          po_number: poNumber,
          status: 'draft',
          payment_status: 'unpaid',
          ordered_at: poOrderedAt || null,
          expected_at: poExpectedAt || null,
          notes: poNotes.trim() || null,
          subtotal_usd: poSubtotal,
          total_usd: poSubtotal,
          amount_paid_usd: 0,
          created_by: userId,
        })
        .select('*, suppliers(id, name)')
        .single()
      if (poErr) throw poErr

      const items = validLines.map(l => ({
        purchase_id: (po as any).id,
        product_id: l.product_id,
        ordered_qty: parseFloat(l.ordered_qty),
        received_qty: 0,
        unit_cost_usd: Math.round(parseFloat(l.unit_cost_usd || '0') * 100),
        total_cost_usd: lineTotal(l),
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(items)
        .select('*, products(id, name, sku, unit)')
      if (itemsErr) throw itemsErr

      const newPo: Purchase = {
        ...(po as any),
        purchase_items: (insertedItems ?? []) as PurchaseItem[],
      }
      setPurchases(prev => [newPo, ...prev])
      setCreateOpen(false)
      resetCreateForm()
      toast.success(`PO ${poNumber} created`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create PO')
    } finally {
      setPoSaving(false)
    }
  }

  const resetCreateForm = () => {
    setPoSupplierId('')
    setPoOrderedAt('')
    setPoExpectedAt('')
    setPoNotes('')
    setPoLines([emptyLine()])
  }

  // ─── Receive stock ──────────────────────────────────────────────────────────
  const openReceive = (po: Purchase) => {
    setViewPo(po)
    const qtys: Record<string, string> = {}
    po.purchase_items.forEach(item => {
      const remaining = item.ordered_qty - item.received_qty
      qtys[item.id] = remaining > 0 ? remaining.toString() : '0'
    })
    setReceiveQtys(qtys)
    setReceiveInvoice(po.invoice_number ?? '')
    setReceiveOpen(true)
  }

  const handleReceive = async () => {
    if (!viewPo) return
    setReceiveSaving(true)
    try {
      const supabase = createClient()
      const updates = viewPo.purchase_items.map(item => {
        const qty = parseFloat(receiveQtys[item.id] || '0')
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.products?.name ?? '',
          newReceived: item.received_qty + qty,
          ordered: item.ordered_qty,
          qty,
          track_stock: products.find(p => p.id === item.product_id)?.track_stock ?? true,
        }
      }).filter(u => u.qty > 0)

      // Update each purchase_item
      for (const u of updates) {
        const { error } = await supabase
          .from('purchase_items')
          .update({ received_qty: u.newReceived, total_cost_usd: u.newReceived * (viewPo.purchase_items.find(i => i.id === u.id)?.unit_cost_usd ?? 0) })
          .eq('id', u.id)
        if (error) throw error
      }

      // Determine new status
      const allReceived = viewPo.purchase_items.every(item => {
        const u = updates.find(u => u.id === item.id)
        const newReceived = u ? item.received_qty + u.qty : item.received_qty
        return newReceived >= item.ordered_qty
      })
      const anyReceived = updates.length > 0
      const newStatus = allReceived ? 'received' : anyReceived ? 'partial' : viewPo.status

      await supabase
        .from('purchases')
        .update({
          status: newStatus,
          received_at: allReceived ? new Date().toISOString() : undefined,
          invoice_number: receiveInvoice.trim() || null,
        })
        .eq('id', viewPo.id)

      // Increase stock_qty for tracked products
      for (const u of updates) {
        if (u.track_stock && u.qty > 0) {
          await supabase
            .from('products')
            .update({ stock_qty: supabase.rpc('increment_stock' as any, { p_product_id: u.product_id, p_qty: u.qty }) })
          // Use direct update instead
          const { data: prod } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', u.product_id)
            .single()
          if (prod) {
            await supabase
              .from('products')
              .update({ stock_qty: (prod as any).stock_qty + u.qty })
              .eq('id', u.product_id)
          }
          // Insert stock movement
          await supabase.from('stock_movements').insert({
            organization_id: organization?.id,
            branch_id: branch?.id,
            product_id: u.product_id,
            movement_type: 'purchase',
            quantity: u.qty,
            unit_cost_usd: viewPo.purchase_items.find(i => i.id === u.id)?.unit_cost_usd ?? 0,
            reference_id: viewPo.id,
            reference_type: 'purchase',
            reason: `PO ${viewPo.po_number}`,
            performed_by: userId,
          })
        }
      }

      // Update local state
      setPurchases(prev => prev.map(p => {
        if (p.id !== viewPo.id) return p
        return {
          ...p,
          status: newStatus,
          invoice_number: receiveInvoice.trim() || p.invoice_number,
          purchase_items: p.purchase_items.map(item => {
            const u = updates.find(u => u.id === item.id)
            return u ? { ...item, received_qty: item.received_qty + u.qty } : item
          }),
        }
      }))
      setReceiveOpen(false)
      setViewPo(null)
      toast.success('Stock received')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to receive stock')
    } finally {
      setReceiveSaving(false)
    }
  }

  // ─── Record payment ─────────────────────────────────────────────────────────
  const handlePayment = async () => {
    if (!payPo) return
    const amount = Math.round(parseFloat(payAmount || '0') * 100)
    if (!amount) { toast.error('Enter a valid amount'); return }
    setPaySaving(true)
    try {
      const supabase = createClient()
      const newPaid = payPo.amount_paid_usd + amount
      const newPaymentStatus =
        newPaid >= payPo.total_usd ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'

      const { error } = await supabase
        .from('purchases')
        .update({ amount_paid_usd: newPaid, payment_status: newPaymentStatus })
        .eq('id', payPo.id)
      if (error) throw error

      setPurchases(prev => prev.map(p =>
        p.id === payPo.id
          ? { ...p, amount_paid_usd: newPaid, payment_status: newPaymentStatus }
          : p
      ))
      setPayPo(null)
      setPayAmount('')
      toast.success('Payment recorded')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to record payment')
    } finally {
      setPaySaving(false)
    }
  }

  // ─── Cancel PO ─────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelPo) return
    setCancelling(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('purchases')
        .update({ status: 'cancelled' })
        .eq('id', cancelPo.id)
      if (error) throw error
      setPurchases(prev => prev.map(p =>
        p.id === cancelPo.id ? { ...p, status: 'cancelled' } : p
      ))
      setCancelPo(null)
      toast.success('PO cancelled')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel PO')
    } finally {
      setCancelling(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">{purchases.length} order{purchases.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#1B2A4A] text-white">
          <Plus className="h-4 w-4 mr-2" /> New PO
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search PO / supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-60"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <ShoppingBag className="h-12 w-12" />
            <p className="text-sm">{search || statusFilter !== 'all' ? 'No purchase orders match your filters' : 'No purchase orders yet'}</p>
            {!search && statusFilter === 'all' && (
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Create your first PO
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-3">PO Number</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Ordered</th>
                  <th className="text-left px-4 py-3">Expected</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Payment</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => (
                  <tr key={po.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{po.po_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{po.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{po.ordered_at ? formatDate(po.ordered_at) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{po.expected_at ? formatDate(po.expected_at) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatUsd(po.total_usd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatUsd(po.amount_paid_usd)}</td>
                    <td className="px-4 py-3">
                      <Badge className={`capitalize ${STATUS_STYLES[po.status] ?? ''}`}>
                        {po.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`capitalize ${PAYMENT_STYLES[po.payment_status] ?? ''}`}>
                        {po.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setViewPo(po); setReceiveOpen(false) }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {['draft', 'sent', 'partial'].includes(po.status) && (
                          <button
                            onClick={() => openReceive(po)}
                            className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600"
                            title="Receive Stock"
                          >
                            <PackageCheck className="h-4 w-4" />
                          </button>
                        )}
                        {po.payment_status !== 'paid' && po.status !== 'cancelled' && (
                          <button
                            onClick={() => { setPayPo(po); setPayAmount('') }}
                            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                            title="Record Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        {po.status === 'draft' && (
                          <button
                            onClick={() => setCancelPo(po)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="Cancel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create PO Sheet ─────────────────────────────────────────── */}
      <Sheet open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetCreateForm() }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Purchase Order</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-6 pb-8">
            {/* Supplier + dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <Label>Supplier <span className="text-red-500">*</span></Label>
                <Select value={poSupplierId} onValueChange={v => setPoSupplierId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Order Date</Label>
                <Input type="date" value={poOrderedAt} onChange={e => setPoOrderedAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expected Date</Label>
                <Input type="date" value={poExpectedAt} onChange={e => setPoExpectedAt(e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500">
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-right px-3 py-2 w-24">Qty</th>
                      <th className="text-right px-3 py-2 w-28">Unit Cost (USD)</th>
                      <th className="text-right px-3 py-2 w-24">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poLines.map((line, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          <Select
                            value={line.product_id}
                            onValueChange={v => updateLine(idx, 'product_id', v ?? '')}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} <span className="text-gray-400">({p.sku})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            value={line.ordered_qty}
                            onChange={e => updateLine(idx, 'ordered_qty', e.target.value)}
                            placeholder="0"
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={line.unit_cost_usd}
                              onChange={e => updateLine(idx, 'unit_cost_usd', e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-xs text-right pl-5"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs font-medium text-gray-700">
                          {formatUsd(lineTotal(line))}
                        </td>
                        <td className="px-1 py-1.5">
                          <button
                            onClick={() => setPoLines(prev => prev.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-500"
                            disabled={poLines.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-right">Total</td>
                      <td className="px-3 py-2 text-sm font-bold text-right">{formatUsd(poSubtotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPoLines(prev => [...prev, emptyLine()])}
                className="w-full border-dashed"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
              </Button>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={poNotes}
                onChange={e => setPoNotes(e.target.value)}
                placeholder="Internal notes for this order..."
                rows={2}
              />
            </div>

            <Separator />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)} disabled={poSaving}>
                Cancel
              </Button>
              <Button className="flex-1 bg-[#1B2A4A] text-white" onClick={handleCreatePo} disabled={poSaving}>
                {poSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create PO
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── View PO Sheet ───────────────────────────────────────────── */}
      <Sheet open={!!viewPo && !receiveOpen} onOpenChange={open => !open && setViewPo(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewPo?.po_number}</SheetTitle>
          </SheetHeader>

          {viewPo && (
            <div className="space-y-4 mt-4 pb-8 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400">Supplier</p><p className="font-medium">{viewPo.suppliers?.name}</p></div>
                <div><p className="text-xs text-gray-400">Status</p><Badge className={`capitalize ${STATUS_STYLES[viewPo.status]}`}>{viewPo.status}</Badge></div>
                <div><p className="text-xs text-gray-400">Ordered</p><p>{viewPo.ordered_at ? formatDate(viewPo.ordered_at) : '—'}</p></div>
                <div><p className="text-xs text-gray-400">Expected</p><p>{viewPo.expected_at ? formatDate(viewPo.expected_at) : '—'}</p></div>
                <div><p className="text-xs text-gray-400">Invoice #</p><p>{viewPo.invoice_number ?? '—'}</p></div>
                <div><p className="text-xs text-gray-400">Payment</p><Badge className={`capitalize ${PAYMENT_STYLES[viewPo.payment_status]}`}>{viewPo.payment_status}</Badge></div>
              </div>

              <Separator />

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left py-1.5">Product</th>
                    <th className="text-right py-1.5">Ordered</th>
                    <th className="text-right py-1.5">Received</th>
                    <th className="text-right py-1.5">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {viewPo.purchase_items.map(item => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-xs text-gray-400">{item.products?.sku}</p>
                      </td>
                      <td className="py-2 text-right">{item.ordered_qty} {item.products?.unit}</td>
                      <td className={`py-2 text-right ${item.received_qty >= item.ordered_qty ? 'text-green-600' : item.received_qty > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {item.received_qty}
                      </td>
                      <td className="py-2 text-right">{formatUsd(item.total_cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="py-2 font-semibold text-right">Total</td>
                    <td className="py-2 font-bold text-right">{formatUsd(viewPo.total_usd)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-right text-gray-500">Paid</td>
                    <td className="py-1 text-right text-gray-500">{formatUsd(viewPo.amount_paid_usd)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1 text-right text-gray-500">Balance</td>
                    <td className="py-1 text-right font-medium text-red-600">{formatUsd(Math.max(0, viewPo.total_usd - viewPo.amount_paid_usd))}</td>
                  </tr>
                </tfoot>
              </table>

              {viewPo.notes && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  {viewPo.notes}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {['draft', 'sent', 'partial'].includes(viewPo.status) && (
                  <Button className="flex-1 bg-[#1B2A4A] text-white" onClick={() => openReceive(viewPo)}>
                    <PackageCheck className="h-4 w-4 mr-2" /> Receive Stock
                  </Button>
                )}
                {viewPo.payment_status !== 'paid' && viewPo.status !== 'cancelled' && (
                  <Button variant="outline" className="flex-1" onClick={() => { setPayPo(viewPo); setPayAmount(''); setViewPo(null) }}>
                    <CreditCard className="h-4 w-4 mr-2" /> Pay
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Receive Stock Sheet ─────────────────────────────────────── */}
      <Sheet open={receiveOpen} onOpenChange={open => { setReceiveOpen(open); if (!open) setViewPo(null) }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Receive Stock — {viewPo?.po_number}</SheetTitle>
          </SheetHeader>

          {viewPo && (
            <div className="space-y-4 mt-4 pb-8">
              <p className="text-sm text-gray-500">Enter the quantity received for each item.</p>

              <div className="space-y-3">
                {viewPo.purchase_items.map(item => {
                  const remaining = item.ordered_qty - item.received_qty
                  return (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.products?.name}</p>
                          <p className="text-xs text-gray-400">
                            Ordered: {item.ordered_qty} · Received: {item.received_qty} · Remaining: {remaining}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-20 shrink-0">Receiving</Label>
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          step={0.001}
                          value={receiveQtys[item.id] ?? ''}
                          onChange={e => setReceiveQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-gray-400 shrink-0">{item.products?.unit}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                <Label>Invoice Number</Label>
                <Input
                  value={receiveInvoice}
                  onChange={e => setReceiveInvoice(e.target.value)}
                  placeholder="e.g. INV-2024-001"
                />
              </div>

              <Separator />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setReceiveOpen(false); setViewPo(null) }} disabled={receiveSaving}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-[#1B2A4A] text-white" onClick={handleReceive} disabled={receiveSaving}>
                  {receiveSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm Receipt
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Payment Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!payPo} onOpenChange={open => !open && setPayPo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment — {payPo?.po_number}</DialogTitle>
          </DialogHeader>

          {payPo && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-medium">{formatUsd(payPo.total_usd)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span>{formatUsd(payPo.amount_paid_usd)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="text-gray-500">Balance Due</span><span className="font-bold text-red-600">{formatUsd(Math.max(0, payPo.total_usd - payPo.amount_paid_usd))}</span></div>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    autoFocus
                    type="number"
                    min={0}
                    step={0.01}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                <button
                  className="text-xs text-[#1B2A4A] hover:underline"
                  onClick={() => setPayAmount(((payPo.total_usd - payPo.amount_paid_usd) / 100).toFixed(2))}
                >
                  Pay full balance
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayPo(null)} disabled={paySaving}>Cancel</Button>
            <Button onClick={handlePayment} disabled={paySaving || !payAmount} className="bg-[#1B2A4A] text-white">
              {paySaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirm ──────────────────────────────────────────── */}
      <AlertDialog open={!!cancelPo} onOpenChange={open => !open && setCancelPo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelPo?.po_number}?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the PO as cancelled. Stock will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-red-600 hover:bg-red-700">
              {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel PO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
