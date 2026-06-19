'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { usePosStore, PaymentEntry } from '@/lib/store/pos-store'
import { formatUsd, formatLbp, usdCentsToLbpPiasters, exchangeRateValue } from '@/lib/currency'
import { PaymentMethod } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash_usd', label: 'Cash USD', icon: '💵' },
  { value: 'cash_lbp', label: 'Cash LBP', icon: '💴' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'whish', label: 'Whish', icon: '📱' },
  { value: 'omt', label: 'OMT', icon: '🏦' },
  { value: 'bob_finance', label: 'BoB Finance', icon: '🏧' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏢' },
  { value: 'other', label: 'Other', icon: '💰' },
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  org: any
  sessionId: string | null
  userId: string
  branchId: string | null
  orgId: string
  onComplete: (sale: any) => void
}

function generateSaleNumber() {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.floor(Math.random() * 9000 + 1000)
  return `SALE-${datePart}-${randPart}`
}

export function CheckoutDialog({
  open, onOpenChange, org, sessionId, userId, branchId, orgId, onComplete,
}: Props) {
  const { items, note, discount_usd, subtotal, taxAmount } = usePosStore()
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: 'cash_usd', amount_usd: 0, amount_lbp: 0, reference: '' },
  ])
  const [loading, setLoading] = useState(false)

  const exchangeRate = org?.exchange_rate ?? 90000
  const vatEnabled = org?.vat_enabled ?? false
  const vatRate = org?.vat_rate ?? 0
  const sub = subtotal()
  const tax = taxAmount(vatRate, vatEnabled)
  const tot = sub + tax
  const totLbp = usdCentsToLbpPiasters(tot, exchangeRate)

  const totalPaidUsd = payments.reduce((s, p) => s + p.amount_usd, 0)
  const totalPaidLbp = payments.reduce((s, p) => s + p.amount_lbp, 0)
  const totalPaidInUsd = totalPaidUsd + Math.round(totalPaidLbp / exchangeRateValue(exchangeRate) / 100) * 100
  const change = totalPaidInUsd - tot
  const isFullyPaid = totalPaidInUsd >= tot

  const updatePayment = (index: number, field: keyof PaymentEntry, value: any) => {
    setPayments(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  const addPayment = () => {
    setPayments(prev => [...prev, { method: 'cash_usd', amount_usd: 0, amount_lbp: 0, reference: '' }])
  }

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index))
  }

  // Quick-fill: set first payment to total
  const quickFill = () => {
    setPayments([{ method: payments[0]?.method ?? 'cash_usd', amount_usd: tot, amount_lbp: 0, reference: '' }])
  }

  const handleCheckout = async () => {
    if (!sessionId || !branchId) {
      toast.error('No active session or branch')
      return
    }
    if (!isFullyPaid) {
      toast.error('Payment is short')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()

      // 1. Insert sale
      const saleNumber = generateSaleNumber()
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          cash_session_id: sessionId,
          cashier_id: userId,
          sale_number: saleNumber,
          status: 'completed',
          subtotal_usd: sub,
          discount_amount_usd: discount_usd,
          tax_amount_usd: tax,
          total_usd: tot,
          total_lbp: totLbp,
          exchange_rate_used: exchangeRate,
          is_return: false,
        })
        .select('id, sale_number, created_at')
        .single()

      if (saleErr) throw saleErr
      const saleId = (saleData as any).id

      // 2. Insert sale items
      const saleItems = items.map(item => ({
        sale_id: saleId,
        product_id: item.product_id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price_usd: item.price_usd,
        unit_price_lbp: item.price_lbp,
        discount_amount_usd: item.discount_usd,
        line_total_usd: item.price_usd * item.quantity - item.discount_usd,
      }))

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
      if (itemsErr) throw itemsErr

      // 3. Insert payments
      const paymentRows = payments
        .filter(p => p.amount_usd > 0 || p.amount_lbp > 0)
        .map(p => ({
          sale_id: saleId,
          method: p.method,
          amount_usd: p.amount_usd,
          amount_lbp: p.amount_lbp,
          reference_number: p.reference || null,
        }))

      if (paymentRows.length > 0) {
        const { error: payErr } = await supabase.from('payments').insert(paymentRows)
        if (payErr) throw payErr
      }

      // 4. Decrease stock_qty directly for each item
      for (const item of items) {
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_qty: item.quantity,
        })
      }

      // 5. Insert stock_movements for each item
      const movements = items.map(item => ({
        organization_id: orgId,
        branch_id: branchId,
        product_id: item.product_id,
        movement_type: 'sale',
        quantity: -item.quantity,
        reference_id: saleId,
        reference_type: 'sale',
        reason: `Sale ${saleNumber}`,
        performed_by: userId,
      }))
      await supabase.from('stock_movements').insert(movements)

      setPayments([{ method: 'cash_usd', amount_usd: 0, amount_lbp: 0, reference: '' }])
      onComplete({ ...saleData, items, payments, change, org })
    } catch (err: any) {
      toast.error(err.message ?? 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatUsd(sub)}</span>
          </div>
          {discount_usd > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount</span><span>-{formatUsd(discount_usd)}</span>
            </div>
          )}
          {vatEnabled && (
            <div className="flex justify-between text-gray-600">
              <span>VAT ({vatRate}%)</span><span>{formatUsd(tax)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <div className="text-right">
              <p>{formatUsd(tot)}</p>
              <p className="text-xs text-gray-400 font-normal">{formatLbp(totLbp)}</p>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Payment</Label>
            <button onClick={quickFill} className="text-xs text-[#1B2A4A] hover:underline">
              Quick fill ${(tot / 100).toFixed(2)}
            </button>
          </div>

          {payments.map((payment, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2">
              {/* Method selector */}
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => updatePayment(idx, 'method', m.value)}
                    className={`text-xs rounded-lg py-1.5 px-1 border transition-colors flex flex-col items-center gap-0.5 ${
                      payment.method === m.value
                        ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span className="leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div className="flex gap-2">
                {payment.method === 'cash_lbp' ? (
                  <div className="flex-1 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">LL</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={payment.amount_lbp > 0 ? payment.amount_lbp / 100 : ''}
                      onChange={e =>
                        updatePayment(idx, 'amount_lbp', Math.round(parseFloat(e.target.value || '0') * 100))
                      }
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex-1 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={payment.amount_usd > 0 ? payment.amount_usd / 100 : ''}
                      onChange={e =>
                        updatePayment(idx, 'amount_usd', Math.round(parseFloat(e.target.value || '0') * 100))
                      }
                      className="pl-6 h-8 text-sm"
                    />
                  </div>
                )}

                {/* Reference (for non-cash) */}
                {!['cash_usd', 'cash_lbp'].includes(payment.method) && (
                  <Input
                    placeholder="Ref #"
                    value={payment.reference}
                    onChange={e => updatePayment(idx, 'reference', e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                )}

                {payments.length > 1 && (
                  <button onClick={() => removePayment(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addPayment}
            className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" /> Split payment
          </button>
        </div>

        {/* Change / balance */}
        <div className={`rounded-lg p-3 text-sm font-medium ${
          isFullyPaid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {isFullyPaid
            ? `Change: ${formatUsd(change)}`
            : `Balance due: ${formatUsd(tot - totalPaidInUsd)}`
          }
        </div>

        <Button
          onClick={handleCheckout}
          disabled={loading || !isFullyPaid}
          className="w-full bg-[#1B2A4A] hover:bg-[#243659] text-white h-11 font-semibold"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Complete Sale
        </Button>
      </DialogContent>
    </Dialog>
  )
}
