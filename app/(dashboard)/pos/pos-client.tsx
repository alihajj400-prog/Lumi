'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePosStore } from '@/lib/store/pos-store'
import { ProductGrid } from './components/product-grid'
import { Cart } from './components/cart'
import { OpenSessionDialog } from './components/open-session-dialog'
import { CheckoutDialog } from './components/checkout-dialog'
import { ReceiptDialog } from './components/receipt-dialog'
import { HeldOrdersSheet } from './components/held-orders-sheet'
import { CloseSessionDialog } from './components/close-session-dialog'
import { ExpenseDialog } from './components/expense-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ShoppingCart,
  Search,
  Pause,
  PlayCircle,
  LogOut,
  Zap,
  Receipt,
} from 'lucide-react'
import { formatUsd } from '@/lib/currency'

interface Props {
  products: any[]
  categories: any[]
  activeSession: any | null
  userId: string
  userProfile: any
  org: any
}

export function PosClient({ products, categories, activeSession, userId, userProfile, org }: Props) {
  const router = useRouter()
  // Narrow Zustand selectors — each subscribes only to what it needs.
  // Wide destructuring caused PosClient to rerender on every cart change,
  // which forced filteredProducts to recompute and ProductGrid to re-render.
  const sessionId    = usePosStore(s => s.sessionId)
  const setSessionId = usePosStore(s => s.setSessionId)
  const hasItems     = usePosStore(s => s.items.length > 0)
  const heldCount    = usePosStore(s => s.heldOrders.length)
  const holdCart     = usePosStore(s => s.holdCart)
  const clearCart    = usePosStore(s => s.clearCart)

  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [showOpen, setShowOpen] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [completedSale, setCompletedSale] = useState<any | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Set session from server on mount
  useEffect(() => {
    if (activeSession && !sessionId) {
      setSessionId(activeSession.id)
    }
  }, [activeSession, sessionId, setSessionId])

  // Barcode/search keyboard shortcut
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

  const hasSession = !!sessionId

  // Memoized so category/search changes recompute only when their deps change,
  // not on every cart update or dialog toggle.
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      const matchesCat = selectedCat === 'all' || p.category_id === selectedCat
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q)
      return matchesCat && matchesSearch
    })
  }, [products, selectedCat, search])

  const handleHold = useCallback(() => {
    if (!hasItems) return
    const label = `Order ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    holdCart(label)
    toast.success('Order held')
  }, [hasItems, holdCart])

  const handleSaleComplete = useCallback((sale: any) => {
    setShowCheckout(false)
    setCompletedSale(sale)
    setShowReceipt(true)
    clearCart()
    router.refresh()
  }, [clearCart, router])

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden bg-gray-50">
      {/* Left: product browser */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white">
        {/* POS top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {/* Session status */}
          {hasSession ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 font-medium shrink-0">
              <Zap className="h-3 w-3 mr-1" />
              Session Open
            </Badge>
          ) : (
            <Button size="sm" onClick={() => setShowOpen(true)} className="bg-[#1B2A4A] text-white shrink-0">
              Open Session
            </Button>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchRef}
              placeholder="Search products (F2)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Held orders */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHeld(true)}
              className="relative"
              disabled={!hasSession}
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              Held
              {heldCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#E8A427] text-white text-[10px] flex items-center justify-center font-bold">
                  {heldCount}
                </span>
              )}
            </Button>

            {/* Hold current */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleHold}
              disabled={!hasItems || !hasSession}
            >
              <Pause className="h-4 w-4 mr-1" />
              Hold
            </Button>

            {/* Log expense */}
            {hasSession && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExpense(true)}
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Expense
              </Button>
            )}

            {/* Close session */}
            {hasSession && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClose(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Category tabs — rendered as a memoized child so selectedCat changes
            only rerender this strip, not the whole PosClient tree */}
        <CategoryTabs
          categories={categories}
          selectedCat={selectedCat}
          onSelect={setSelectedCat}
        />

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasSession ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <ShoppingCart className="h-12 w-12" />
              <p className="text-sm">Open a cash session to start selling</p>
              <Button onClick={() => setShowOpen(true)} className="bg-[#1B2A4A] text-white">
                Open Session
              </Button>
            </div>
          ) : (
            <ProductGrid products={filteredProducts} disabled={!hasSession} />
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="w-[360px] shrink-0 flex flex-col bg-white">
        <Cart
          org={org}
          onCheckout={() => setShowCheckout(true)}
          disabled={!hasSession}
        />
      </div>

      {/* Dialogs */}
      <OpenSessionDialog
        open={showOpen}
        onOpenChange={setShowOpen}
        userId={userId}
        branchId={userProfile?.branch_id}
        orgId={userProfile?.organization_id}
        onOpened={(id) => {
          setSessionId(id)
          setShowOpen(false)
          toast.success('Session opened')
          router.refresh()
        }}
      />

      <CheckoutDialog
        open={showCheckout}
        onOpenChange={setShowCheckout}
        org={org}
        sessionId={sessionId}
        userId={userId}
        branchId={userProfile?.branch_id}
        orgId={userProfile?.organization_id}
        onComplete={handleSaleComplete}
      />

      {completedSale && (
        <ReceiptDialog
          open={showReceipt}
          onOpenChange={setShowReceipt}
          sale={completedSale}
          org={org}
          onNewSale={() => {
            setShowReceipt(false)
            setCompletedSale(null)
          }}
        />
      )}

      <HeldOrdersSheet
        open={showHeld}
        onOpenChange={setShowHeld}
      />

      <CloseSessionDialog
        open={showClose}
        onOpenChange={setShowClose}
        sessionId={sessionId}
        org={org}
        onClosed={() => {
          setSessionId('')
          setShowClose(false)
          toast.success('Session closed')
          router.refresh()
        }}
      />

      {sessionId && (
        <ExpenseDialog
          open={showExpense}
          onOpenChange={setShowExpense}
          sessionId={sessionId}
          cashierId={userId}
          branchId={userProfile?.branch_id ?? ''}
          orgId={userProfile?.organization_id ?? ''}
          onSaved={() => {
            setShowExpense(false)
            toast.success('Expense logged')
          }}
        />
      )}
    </div>
  )
}

// Memoized so it only rerenders when selectedCat or categories list changes.
// Extracted from PosClient to prevent the entire parent from rerendering
// just because the active tab highlight changed.
const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCat,
  onSelect,
}: {
  categories: { id: string; name: string; color: string | null; icon?: string }[]
  selectedCat: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100">
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selectedCat === 'all'
            ? 'bg-[#1B2A4A] text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
            selectedCat === cat.id
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selectedCat === cat.id ? { backgroundColor: cat.color ?? '#1B2A4A' } : undefined}
        >
          {cat.icon && <span>{cat.icon}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  )
})
