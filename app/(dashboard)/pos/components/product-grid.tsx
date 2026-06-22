'use client'

import { memo, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { usePosStore } from '@/lib/store/pos-store'
import { formatUsd, formatLbp } from '@/lib/currency'
import { filterProductsByCategoryAndSearch } from '@/lib/products/filter-products'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'

export interface PosProduct {
  id: string
  name: string
  name_ar: string | null
  sku: string
  barcode?: string | null
  category_id: string | null
  unit: string
  price_usd: number
  price_lbp: number
  stock_qty: number
  track_stock: boolean
  reorder_level?: number
  image_url: string | null
}

interface Props {
  products: PosProduct[]
  selectedCat: string
  search: string
  disabled?: boolean
}

interface CardProps {
  product: PosProduct
  visible: boolean
  disabled: boolean
  onAdd: (p: PosProduct) => void
}

const ProductCard = memo(function ProductCard({
  product: p,
  visible,
  disabled,
  onAdd,
}: CardProps) {
  const outOfStock = p.track_stock && p.stock_qty <= 0
  const handleClick = useCallback(() => onAdd(p), [onAdd, p])

  return (
    <button
      type="button"
      disabled={disabled || outOfStock || !visible}
      onClick={handleClick}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`
        relative flex flex-col rounded-xl border text-left transition-[border-color,box-shadow,transform] duration-150
        ${!visible ? 'hidden' : ''}
        ${outOfStock || disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-[#1B2A4A] hover:shadow-md active:scale-95 cursor-pointer'
        }
      `}
    >
      <div className="relative w-full aspect-square rounded-t-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {p.image_url ? (
          <Image
            src={p.image_url}
            alt={p.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            loading="lazy"
            className="object-cover"
          />
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
})

export const ProductGrid = memo(function ProductGrid({
  products,
  selectedCat,
  search,
  disabled,
}: Props) {
  const addItem = usePosStore((s) => s.addItem)

  const handleAdd = useCallback(
    (p: PosProduct) => {
      addItem({
        product_id: p.id,
        name: p.name,
        name_ar: p.name_ar,
        sku: p.sku,
        unit: p.unit,
        price_usd: p.price_usd,
        price_lbp: p.price_lbp,
      })
    },
    [addItem]
  )

  const visibleIds = useMemo(() => {
    const visible = filterProductsByCategoryAndSearch(products, selectedCat, search)
    return new Set(visible.map((p) => p.id))
  }, [products, selectedCat, search])

  const visibleCount = visibleIds.size

  if (products.length === 0 || visibleCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
        <Package className="h-8 w-8" />
        <p className="text-sm">No products found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          visible={visibleIds.has(p.id)}
          disabled={!!disabled}
          onAdd={handleAdd}
        />
      ))}
    </div>
  )
})
