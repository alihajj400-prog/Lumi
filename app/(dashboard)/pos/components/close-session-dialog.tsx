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
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  sessionId: string | null
  org: any
  onClosed: () => void
}

export function CloseSessionDialog({ open, onOpenChange, sessionId, org, onClosed }: Props) {
  const [closingCash, setClosingCash] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const supabase = createClient()

      // Get expected cash from session sales
      const { data: sessionSales } = await supabase
        .from('sales')
        .select('total_usd')
        .eq('cash_session_id', sessionId)
        .eq('status', 'completed')

      const salesTotal = ((sessionSales ?? []) as any[]).reduce(
        (s: number, sale: any) => s + (sale.total_usd ?? 0), 0
      )

      const closingCashUsd = Math.round(parseFloat(closingCash || '0') * 100)

      const { error } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closing_cash_usd: closingCashUsd,
          expected_cash_usd: salesTotal,
          difference_usd: closingCashUsd - salesTotal,
        })
        .eq('id', sessionId)

      if (error) throw error
      setClosingCash('')
      onClosed()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to close session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close Cash Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">
            Count the cash in your drawer and enter the closing amount.
          </p>

          <div className="space-y-2">
            <Label>Closing Cash (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={closingCash}
                onChange={e => setClosingCash(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleClose}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Close Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
