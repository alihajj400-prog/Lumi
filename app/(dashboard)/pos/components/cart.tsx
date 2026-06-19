'use client'

import { useState } from 'react'
import { usePosStore } from '@/lib/store/pos-store'
import { formatUsd, formatLbp, usdCentsToLbpPiasters } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, Trash2, Plus, Minus, X } from 'lucide-react'

interface Props {
  org: any
  onCheckout: () => void
  disabled?: boolean
}

export function Cart({ org, onCheckout, disabled }: Props) {
  const {
    items,
    note,
    discount_usd,
    removeItem,
    updateQty,
    setNote,
    setCartDiscount,
    clearCart,
    subtotal,
    taxAmount,
    total,
  } = usePosStore()

  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discountInput, setDiscountInput] = useState('')

  const sub = subtotal()
  const tax = taxAmount(org?.vat_rate ?? 0, org?.vat_enabled ?? false)
  const tot = sub + tax
  const totLbp = usdCentsToLbpPiasters(tot, org?.exchange_rate ?? 90000)

  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <ShoppingCart className="h-4 w-4" />
          Cart
          {items.length > 0 && (
            <span className="text-xs bg-[#1B2A4A] text-white rounded-full px-2 py-0.5">
              {items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
        {!isEmpty && (
          <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Items */}
      <ScrollArea className="flex-1 px-3 py-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
            <ShoppingCart className="h-10 w-10" />
            <p className="text-sm">Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.product_id} className="flex items-start gap-2 py-2 border-b border-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.sku} · {item.unit}</p>
                  <p className="text-xs font-semibold text-[#1B2A4A] mt-0.5">
                    {formatUsd(item.price_usd * item.quantity)}
                  </p>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQty(item.product_id, item.quantity - 1)}
                    className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateQty(item.product_id, parseFloat(e.target.value) || 1)}
                    className="w-8 text-center text-sm border border-gray-200 rounded h-6 p-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updateQty(item.product_id, item.quantity + 1)}
                    className="h-6 w-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="h-6 w-6 rounded flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Note */}
      <div className="px-3 py-2 border-t border-gray-100">
        <Input
          placeholder="Order note..."
          value={note}
          onChange={e => setNote(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Totals */}
      <div className="px-4 py-3 border-t border-gray-100 space-y-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatUsd(sub)}</span>
        </div>

        {/* Discount */}
        <div className="flex justify-between text-sm text-gray-600 items-center">
          <span>Discount</span>
          {editingDiscount ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">$</span>
              <input
                autoFocus
                type="number"
                min={0}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                onBlur={() => {
                  const val = Math.round(parseFloat(discountInput || '0') * 100)
                  setCartDiscount(val)
                  setEditingDiscount(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = Math.round(parseFloat(discountInput || '0') * 100)
                    setCartDiscount(val)
                    setEditingDiscount(false)
                  }
                  if (e.key === 'Escape') setEditingDiscount(false)
                }}
                className="w-16 text-right text-sm border border-gray-300 rounded px-1 h-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setDiscountInput(discount_usd > 0 ? (discount_usd / 100).toString() : '')
                setEditingDiscount(true)
              }}
              className="text-sm text-red-500 hover:underline"
            >
              {discount_usd > 0 ? `-${formatUsd(discount_usd)}` : '+ Add'}
            </button>
          )}
        </div>

        {org?.vat_enabled && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>VAT ({org.vat_rate}%)</span>
            <span>{formatUsd(tax)}</span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between font-bold text-base text-gray-900">
          <span>Total</span>
          <div className="text-right">
            <p>{formatUsd(tot)}</p>
            <p className="text-xs text-gray-400 font-normal">{formatLbp(totLbp)}</p>
          </div>
        </div>
      </div>

      {/* Checkout button */}
      <div className="px-4 pb-4">
        <Button
          className="w-full bg-[#1B2A4A] hover:bg-[#243659] text-white h-12 text-base font-semibold"
          disabled={isEmpty || disabled}
          onClick={onCheckout}
        >
          Checkout · {formatUsd(tot)}
        </Button>
      </div>
    </div>
  )
}
