'use client'

import { usePosStore } from '@/lib/store/pos-store'
import { formatUsd, formatLbp } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'

interface Props {
  products: any[]
  disabled?: boolean
}

export function ProductGrid({ products, disabled }: Props) {
  const addItem = usePosStore(s => s.addItem)

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
        <Package className="h-8 w-8" />
        <p className="text-sm">No products found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {products.map(p => {
        const outOfStock = p.track_stock && p.stock_qty <= 0
        return (
          <button
            key={p.id}
            disabled={disabled || outOfStock}
            onClick={() =>
              addItem({
                product_id: p.id,
                name: p.name,
                name_ar: p.name_ar,
                sku: p.sku,
                unit: p.unit,
                price_usd: p.price_usd,
                price_lbp: p.price_lbp,
              })
            }
            className={`
              relative flex flex-col rounded-xl border text-left transition-all
              ${outOfStock || disabled
                ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                : 'bg-white border-gray-200 hover:border-[#1B2A4A] hover:shadow-md active:scale-95 cursor-pointer'
              }
            `}
          >
            {/* Image or placeholder */}
            <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-gray-100 flex items-center justify-center">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-8 w-8 text-gray-300" />
              )}
            </div>

            <div className="p-2 flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">{p.name}</p>
              <p className="text-xs text-[#1B2A4A] font-bold">{formatUsd(p.price_usd)}</p>
              <p className="text-[10px] text-gray-400">{formatLbp(p.price_lbp)}</p>
            </div>

            {outOfStock && (
              <Badge className="absolute top-1 right-1 bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0.5">
                Out
              </Badge>
            )}

            {p.track_stock && p.stock_qty > 0 && p.stock_qty <= (p.reorder_level ?? 0) && (
              <Badge className="absolute top-1 right-1 bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0.5">
                Low
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
