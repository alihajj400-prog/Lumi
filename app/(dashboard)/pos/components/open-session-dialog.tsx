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
  userId: string
  branchId: string | null
  orgId: string
  onOpened: (sessionId: string) => void
}

export function OpenSessionDialog({ open, onOpenChange, userId, branchId, orgId, onOpened }: Props) {
  const [openingCashUsd, setOpeningCashUsd] = useState('')
  const [openingCashLbp, setOpeningCashLbp] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    if (!branchId) {
      toast.error('No branch assigned to your account')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          cashier_id: userId,
          opening_cash_usd: Math.round(parseFloat(openingCashUsd || '0') * 100),
          opening_cash_lbp: Math.round(parseFloat(openingCashLbp || '0') * 100),
          status: 'open',
        })
        .select('id')
        .single()

      if (error) throw error
      onOpened((data as any).id)
      setOpeningCashUsd('')
      setOpeningCashLbp('')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to open session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Open Cash Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">
            Enter the opening cash amount in your drawer before starting.
          </p>

          <div className="space-y-2">
            <Label>Opening Cash (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={openingCashUsd}
                onChange={e => setOpeningCashUsd(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Opening Cash (LBP)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">LL</span>
              <Input
                type="number"
                min={0}
                step={1000}
                placeholder="0"
                value={openingCashLbp}
                onChange={e => setOpeningCashLbp(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleOpen} disabled={loading} className="bg-[#1B2A4A] text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Open Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
