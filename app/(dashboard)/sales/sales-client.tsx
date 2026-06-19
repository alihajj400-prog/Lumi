'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatUsd, formatLbp } from '@/lib/currency'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Search, Eye, XCircle, Loader2, Receipt } from 'lucide-react'

interface Sale {
  id: string
  sale_number: string
  status: string
  subtotal_usd: number
  discount_amount_usd: number
  tax_amount_usd: number
  total_usd: number
  total_lbp: number
  exchange_rate_used: number
  is_return: boolean
  void_reason: string | null
  created_at: string
  payments: { method: string; amount_usd: number; amount_lbp: number }[]
  sale_items: { id: string; product_name: string; quantity: number; unit_price_usd: number; line_total_usd: number }[]
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 border-green-200',
  voided: 'bg-red-100 text-red-600 border-red-200',
  refunded: 'bg-amber-100 text-amber-700 border-amber-200',
  held: 'bg-gray-100 text-gray-500 border-gray-200',
}

const METHOD_LABEL: Record<string, string> = {
  cash_usd: 'Cash USD', cash_lbp: 'Cash LBP', card: 'Card',
  whish: 'Whish', omt: 'OMT', bob_finance: 'BoB Finance',
  bank_transfer: 'Bank Transfer', other: 'Other',
}

export function SalesClient({ initialSales }: { initialSales: Sale[] }) {
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewSale, setViewSale] = useState<Sale | null>(null)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const q = search.toLowerCase()
      const matchSearch = !q || s.sale_number.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      const saleDate = new Date(s.created_at)
      const matchFrom = !dateFrom || saleDate >= new Date(dateFrom)
      const matchTo = !dateTo || saleDate <= new Date(dateTo + 'T23:59:59')
      return matchSearch && matchStatus && matchFrom && matchTo
    })
  }, [sales, search, statusFilter, dateFrom, dateTo])

  const totalRevenue = filtered
    .filter(s => s.status === 'completed')
    .reduce((s, sale) => s + sale.total_usd, 0)

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) {
      toast.error('Enter a void reason')
      return
    }
    setVoiding(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('sales')
        .update({ status: 'voided', void_reason: voidReason.trim() })
        .eq('id', voidTarget.id)
      if (error) throw error
      setSales(prev => prev.map(s =>
        s.id === voidTarget.id ? { ...s, status: 'voided', void_reason: voidReason.trim() } : s
      ))
      setVoidTarget(null)
      setVoidReason('')
      toast.success('Sale voided')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to void sale')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
        <p className="text-sm text-gray-500 mt-1">{sales.length} transactions</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Showing', value: filtered.length + ' sales' },
          { label: 'Revenue (filtered)', value: formatUsd(totalRevenue) },
          { label: 'Completed', value: filtered.filter(s => s.status === 'completed').length + '' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Sale number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36" />
        <span className="text-gray-400 text-sm">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36" />
        {(dateFrom || dateTo || search || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="text-left px-4 py-3">Sale #</th>
                <th className="text-left px-4 py-3">Date / Time</th>
                <th className="text-right px-4 py-3">Items</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sales found</td></tr>
              ) : filtered.map(sale => (
                <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{sale.sale_number}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(sale.created_at)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{sale.sale_items.length}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatUsd(sale.total_usd)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sale.payments.map((p, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                          {METHOD_LABEL[p.method] ?? p.method}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`capitalize text-xs ${STATUS_STYLES[sale.status] ?? ''}`}>{sale.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setViewSale(sale)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      {sale.status === 'completed' && (
                        <button onClick={() => { setVoidTarget(sale); setVoidReason('') }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Sale Sheet */}
      <Sheet open={!!viewSale} onOpenChange={open => !open && setViewSale(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewSale?.sale_number}</SheetTitle>
          </SheetHeader>
          {viewSale && (
            <div className="mt-4 space-y-4 pb-8 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{formatDateTime(viewSale.created_at)}</span>
                <Badge className={`capitalize ${STATUS_STYLES[viewSale.status] ?? ''}`}>{viewSale.status}</Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-400 border-b">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewSale.sale_items.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatUsd(item.unit_price_usd)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatUsd(item.line_total_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                {viewSale.discount_amount_usd > 0 && (
                  <div className="flex justify-between text-red-600 text-sm">
                    <span>Discount</span><span>-{formatUsd(viewSale.discount_amount_usd)}</span>
                  </div>
                )}
                {viewSale.tax_amount_usd > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Tax</span><span>{formatUsd(viewSale.tax_amount_usd)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <div className="text-right">
                    <p>{formatUsd(viewSale.total_usd)}</p>
                    <p className="text-xs text-gray-400 font-normal">{formatLbp(viewSale.total_lbp)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-400 font-medium">PAYMENTS</p>
                {viewSale.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{METHOD_LABEL[p.method] ?? p.method}</span>
                    <span>{p.amount_lbp > 0 ? formatLbp(p.amount_lbp) : formatUsd(p.amount_usd)}</span>
                  </div>
                ))}
              </div>

              {viewSale.void_reason && (
                <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
                  <p className="font-medium">Void Reason</p>
                  <p>{viewSale.void_reason}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Void Dialog */}
      <Dialog open={!!voidTarget} onOpenChange={open => !open && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Void Sale — {voidTarget?.sale_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">This sale will be marked as voided. Stock levels will not be automatically reversed.</p>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea
                autoFocus
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Why is this sale being voided?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</Button>
            <Button onClick={handleVoid} disabled={voiding || !voidReason.trim()} className="bg-red-600 hover:bg-red-700 text-white">
              {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Void Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
