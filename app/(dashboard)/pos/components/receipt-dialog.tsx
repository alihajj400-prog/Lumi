'use client'

import { useRef } from 'react'
import { formatUsd, formatLbp } from '@/lib/currency'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer, RefreshCw } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  sale: any
  org: any
  onNewSale: () => void
}

const METHOD_LABEL: Record<string, string> = {
  cash_usd: 'Cash USD',
  cash_lbp: 'Cash LBP',
  card: 'Card',
  whish: 'Whish',
  omt: 'OMT',
  bob_finance: 'BoB Finance',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}

export function ReceiptDialog({ open, onOpenChange, sale, org, onNewSale }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`
      <html><head><title>Receipt ${sale.sale_number}</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 16px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #999; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
      </style></head><body>`)
    win.document.write(content.innerHTML)
    win.document.write('</body></html>')
    win.document.close()
    win.print()
  }

  const saleDate = sale.created_at
    ? new Date(sale.created_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>

        {/* Printable receipt */}
        <div ref={receiptRef} className="font-mono text-xs border rounded-lg p-4 bg-white space-y-2">
          <div className="text-center font-bold text-sm">{org?.name ?? 'LUMI POS'}</div>
          <div className="text-center text-gray-500">{saleDate}</div>
          <div className="text-center text-gray-500">#{sale.sale_number}</div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <table className="w-full">
            <tbody>
              {(sale.items ?? []).map((item: any, i: number) => (
                <tr key={i}>
                  <td className="align-top pr-2">
                    <div>{item.name}</div>
                    <div className="text-gray-400">×{item.quantity}</div>
                  </td>
                  <td className="text-right align-top whitespace-nowrap">
                    {formatUsd(item.price_usd * item.quantity - (item.discount_usd ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatUsd(sale.subtotal_usd ?? 0)}</span>
            </div>
            {(sale.discount_amount_usd ?? 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{formatUsd(sale.discount_amount_usd)}</span>
              </div>
            )}
            {(sale.tax_amount_usd ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>VAT</span>
                <span>{formatUsd(sale.tax_amount_usd)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-dashed border-gray-300 pt-1">
              <span>TOTAL</span>
              <span>{formatUsd(sale.total_usd ?? 0)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span></span>
              <span>{formatLbp(sale.total_lbp ?? 0)}</span>
            </div>
          </div>

          {/* Payments */}
          {(sale.payments ?? []).length > 0 && (
            <>
              <div className="border-t border-dashed border-gray-300 my-2" />
              {(sale.payments ?? []).map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{METHOD_LABEL[p.method] ?? p.method}</span>
                  <span>{p.amount_lbp > 0 ? formatLbp(p.amount_lbp) : formatUsd(p.amount_usd)}</span>
                </div>
              ))}
              {(sale.change ?? 0) > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Change</span>
                  <span>{formatUsd(sale.change)}</span>
                </div>
              )}
            </>
          )}

          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center text-gray-400">Thank you!</div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button
            onClick={onNewSale}
            className="flex-1 bg-[#1B2A4A] text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            New Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
