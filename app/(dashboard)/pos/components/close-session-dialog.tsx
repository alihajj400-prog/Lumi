'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatUsd, formatLbp } from '@/lib/currency'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Printer } from 'lucide-react'

const METHOD_LABEL: Record<string, string> = {
  cash_usd: 'Cash USD', cash_lbp: 'Cash LBP', card: 'Card',
  whish: 'Whish', omt: 'OMT', bob_finance: 'BoB Finance',
  bank_transfer: 'Bank Transfer', other: 'Other',
}

const EXPENSE_LABEL: Record<string, string> = {
  supplier_payment: 'Supplier Payment', tip: 'Tip / Gratuity',
  cleaning: 'Cleaning', maintenance: 'Maintenance', staff: 'Staff', other: 'Other',
}

// USD bill denominations for counting
const BILLS = [100, 50, 20, 10, 5, 1]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  sessionId: string | null
  org: any
  onClosed: () => void
}

export function CloseSessionDialog({ open, onOpenChange, sessionId, org, onClosed }: Props) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sessionData, setSessionData] = useState<any | null>(null)

  // Denomination counts (bill → quantity)
  const [bills, setBills] = useState<Record<number, string>>(
    Object.fromEntries(BILLS.map(b => [b, '']))
  )

  const countedCash = BILLS.reduce((s, b) => s + (parseInt(bills[b] || '0') * b * 100), 0)

  useEffect(() => {
    if (!open || !sessionId) return
    loadSessionData()
  }, [open, sessionId])

  const loadSessionData = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const [salesRes, expensesRes, sessionRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total_usd, total_lbp, payments(method, amount_usd, amount_lbp)')
          .eq('cash_session_id', sessionId)
          .eq('status', 'completed'),
        supabase
          .from('cash_expenses')
          .select('category, amount_usd, amount_lbp, note, created_at')
          .eq('cash_session_id', sessionId),
        supabase
          .from('cash_sessions')
          .select('opened_at, opening_cash_usd')
          .eq('id', sessionId)
          .single(),
      ])

      const sales: any[] = salesRes.data ?? []
      const expenses: any[] = expensesRes.data ?? []
      const session = sessionRes.data

      // Sales by payment method
      const byMethod: Record<string, number> = {}
      sales.forEach(s => {
        ;(s.payments ?? []).forEach((p: any) => {
          byMethod[p.method] = (byMethod[p.method] ?? 0) + (p.amount_usd ?? 0)
        })
      })

      const totalSalesUsd = sales.reduce((s, sale) => s + (sale.total_usd ?? 0), 0)
      const totalExpensesUsd = expenses.reduce((s, e) => s + (e.amount_usd ?? 0), 0)
      const openingCash = session?.opening_cash_usd ?? 0
      const expectedCash = openingCash + (byMethod['cash_usd'] ?? 0) - totalExpensesUsd

      setSessionData({
        sales,
        expenses,
        byMethod,
        totalSalesUsd,
        totalExpensesUsd,
        openingCash,
        expectedCash,
        openedAt: session?.opened_at,
      })
    } catch (err: any) {
      toast.error('Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (!sessionId || !sessionData) return
    setClosing(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closing_cash_usd: countedCash,
          expected_cash_usd: sessionData.expectedCash,
          difference_usd: countedCash - sessionData.expectedCash,
        })
        .eq('id', sessionId)
      if (error) throw error
      onClosed()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to close session')
    } finally {
      setClosing(false)
    }
  }

  const handlePrint = () => {
    const el = reportRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) return
    win.document.write(`<html><head><title>Z-Report</title>
    <style>
      body { font-family: monospace; font-size: 12px; padding: 16px; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #999; margin: 6px 0; }
    </style></head><body>`)
    win.document.write(el.innerHTML)
    win.document.write('</body></html>')
    win.document.close()
    win.print()
  }

  const variance = countedCash - (sessionData?.expectedCash ?? 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close Cash Session</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : sessionData ? (
          <Tabs defaultValue="count">
            <TabsList className="w-full">
              <TabsTrigger value="count" className="flex-1">Cash Count</TabsTrigger>
              <TabsTrigger value="summary" className="flex-1">Session Summary</TabsTrigger>
            </TabsList>

            {/* Cash denomination counter */}
            <TabsContent value="count" className="space-y-4 mt-4">
              <p className="text-sm text-gray-500">Count the USD bills in your drawer:</p>
              <div className="space-y-2">
                {BILLS.map(bill => (
                  <div key={bill} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-12 text-right text-gray-700">${bill}</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={bills[bill]}
                      onChange={e => setBills(prev => ({ ...prev, [bill]: e.target.value }))}
                      className="w-24 h-8 text-sm text-center"
                    />
                    <span className="text-xs text-gray-400">
                      = {formatUsd((parseInt(bills[bill] || '0') * bill * 100))}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Opening cash</span>
                  <span>{formatUsd(sessionData.openingCash)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Cash sales</span>
                  <span>+{formatUsd(sessionData.byMethod['cash_usd'] ?? 0)}</span>
                </div>
                {sessionData.totalExpensesUsd > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Expenses paid out</span>
                    <span>-{formatUsd(sessionData.totalExpensesUsd)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1.5">
                  <span>Expected in drawer</span>
                  <span>{formatUsd(sessionData.expectedCash)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Counted cash</span>
                  <span>{formatUsd(countedCash)}</span>
                </div>
                <div className={`flex justify-between font-bold text-base border-t pt-1.5 ${variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  <span>Variance</span>
                  <span>{variance >= 0 ? '+' : ''}{formatUsd(variance)}</span>
                </div>
              </div>
            </TabsContent>

            {/* Session summary / Z-report */}
            <TabsContent value="summary" className="mt-4">
              <div ref={reportRef} className="font-mono text-xs space-y-2">
                <div className="text-center font-bold text-sm">{org?.name ?? 'LUMI POS'}</div>
                <div className="text-center text-gray-500">Z-REPORT</div>
                <div className="text-center text-gray-500">
                  {sessionData.openedAt ? new Date(sessionData.openedAt).toLocaleString() : ''}
                  {' → '}
                  {new Date().toLocaleString()}
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                <div className="flex justify-between">
                  <span>Total Sales</span>
                  <span className="font-bold">{formatUsd(sessionData.totalSalesUsd)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span># Transactions</span>
                  <span>{sessionData.sales.length}</span>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="font-semibold text-gray-600">BY PAYMENT METHOD</div>
                {Object.entries(sessionData.byMethod).map(([method, amt]: any) => (
                  <div key={method} className="flex justify-between">
                    <span>{METHOD_LABEL[method] ?? method}</span>
                    <span>{formatUsd(amt)}</span>
                  </div>
                ))}

                {sessionData.expenses.length > 0 && (
                  <>
                    <div className="border-t border-dashed border-gray-300 my-2" />
                    <div className="font-semibold text-gray-600">EXPENSES</div>
                    {sessionData.expenses.map((e: any, i: number) => (
                      <div key={i} className="flex justify-between text-red-700">
                        <span>{EXPENSE_LABEL[e.category] ?? e.category}{e.note ? ` (${e.note})` : ''}</span>
                        <span>-{e.amount_usd > 0 ? formatUsd(e.amount_usd) : formatLbp(e.amount_lbp)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-red-700">
                      <span>Total Expenses</span>
                      <span>-{formatUsd(sessionData.totalExpensesUsd)}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="flex justify-between font-bold">
                  <span>Expected Cash</span>
                  <span>{formatUsd(sessionData.expectedCash)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Counted Cash</span>
                  <span>{formatUsd(countedCash)}</span>
                </div>
                <div className={`flex justify-between font-bold ${variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  <span>Variance</span>
                  <span>{variance >= 0 ? '+' : ''}{formatUsd(variance)}</span>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="text-center text-gray-400">*** END OF REPORT ***</div>
              </div>

              <Button variant="outline" onClick={handlePrint} className="w-full mt-4">
                <Printer className="h-4 w-4 mr-2" />
                Print Z-Report
              </Button>
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closing} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleClose}
            disabled={closing || loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Close Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
