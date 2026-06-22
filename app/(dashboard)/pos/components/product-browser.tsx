'use client'

import {
  useState,
  useCallback,
  useTransition,
  useDeferredValue,
  memo,
  useEffect,
  useRef,
} from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { CategoryTabs, type PosCategory } from './category-tabs'
import { ProductGrid, type PosProduct } from './product-grid'

interface Props {
  products: PosProduct[]
  categories: PosCategory[]
  hasSession: boolean
  onOpenSession: () => void
}

/** Owns category/search state so switching tabs does not rerender Cart or dialogs. */
export const ProductBrowser = memo(function ProductBrowser({
  products,
  categories,
  hasSession,
  onOpenSession,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [, startTransition] = useTransition()
  const deferredSearch = useDeferredValue(search)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSelectCat = useCallback((categoryId: string) => {
    startTransition(() => setSelectedCat(categoryId))
  }, [])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="relative px-4 py-2 border-b border-gray-100">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={searchRef}
          placeholder="Search products (F2)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
          disabled={!hasSession}
        />
      </div>

      <CategoryTabs
        categories={categories}
        selectedCat={selectedCat}
        onSelect={handleSelectCat}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {!hasSession ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <ShoppingCart className="h-12 w-12" />
            <p className="text-sm">Open a cash session to start selling</p>
            <Button onClick={onOpenSession} className="bg-[#1B2A4A] text-white">
              Open Session
            </Button>
          </div>
        ) : (
          <ProductGrid
            products={products}
            selectedCat={selectedCat}
            search={deferredSearch}
            disabled={false}
          />
        )}
      </div>
    </div>
  )
})
