'use client'

import { usePosStore } from '@/lib/store/pos-store'
import { formatUsd } from '@/lib/currency'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PlayCircle, Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function HeldOrdersSheet({ open, onOpenChange }: Props) {
  const { heldOrders, resumeHeld, deleteHeld } = usePosStore()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Held Orders ({heldOrders.length})</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {heldOrders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No held orders</p>
          ) : (
            heldOrders.map(order => {
              const total = order.items.reduce(
                (s, i) => s + i.price_usd * i.quantity - i.discount_usd,
                0
              )
              return (
                <div key={order.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{order.label}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(order.heldAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {order.items.reduce((s, i) => s + i.quantity, 0)} items
                      </p>
                    </div>
                    <p className="font-bold text-sm">{formatUsd(total)}</p>
                  </div>

                  <div className="space-y-0.5">
                    {order.items.slice(0, 3).map(item => (
                      <p key={item.product_id} className="text-xs text-gray-500 truncate">
                        {item.quantity}× {item.name}
                      </p>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-gray-400">+{order.items.length - 3} more</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#1B2A4A] text-white h-8 text-xs"
                      onClick={() => {
                        resumeHeld(order.id)
                        onOpenChange(false)
                      }}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => deleteHeld(order.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
