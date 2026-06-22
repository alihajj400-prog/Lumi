'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'supplier_payment', label: 'Supplier Payment' },
  { value: 'tip', label: 'Tip / Gratuity' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'staff', label: 'Staff Expense' },
  { value: 'other', label: 'Other' },
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  sessionId: string
  cashierId: string
  branchId: string
  orgId: string
  onSaved: (expense: any) => void
}

export function ExpenseDialog({ open, onOpenChange, sessionId, cashierId, branchId, orgId, onSaved }: Props) {
  const [category, setCategory] = useState('other')
  const [currency, setCurrency] = useState<'usd' | 'lbp'>('usd')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setCategory('other')
    setCurrency('usd')
    setAmount('')
    setNote('')
  }

  const handleSave = async () => {
    const parsed = parseFloat(amount || '0')
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const amount_usd = currency === 'usd' ? Math.round(parsed * 100) : 0
      const amount_lbp = currency === 'lbp' ? Math.round(parsed * 100) : 0

      const { data, error } = await supabase
        .from('cash_expenses')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          cash_session_id: sessionId,
          cashier_id: cashierId,
          category,
          amount_usd,
          amount_lbp,
          note: note.trim() || null,
        })
        .select()
        .single()

      if (error) throw error
      onSaved(data)
      reset()
      toast.success('Expense logged')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to log expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={v => setCategory(v ?? 'other')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Amount</Label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setCurrency('usd')}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${currency === 'usd' ? 'bg-[#1B2A4A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  USD
                </button>
                <button
                  onClick={() => setCurrency('lbp')}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${currency === 'lbp' ? 'bg-[#1B2A4A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  LBP
                </button>
              </div>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {currency === 'usd' ? '$' : 'LL'}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={currency === 'usd' ? 0.01 : 1000}
                  placeholder={currency === 'usd' ? '0.00' : '0'}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Who / what was paid..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !amount} className="bg-[#1B2A4A] text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log Expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
