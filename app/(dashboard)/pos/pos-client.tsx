'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { usePosStore } from '@/lib/store/pos-store'
import { ProductBrowser } from './components/product-browser'
import { Cart } from './components/cart'
import { OpenSessionDialog } from './components/open-session-dialog'
import { CheckoutDialog } from './components/checkout-dialog'
import { ReceiptDialog } from './components/receipt-dialog'
import { HeldOrdersSheet } from './components/held-orders-sheet'
import { CloseSessionDialog } from './components/close-session-dialog'
import { ExpenseDialog } from './components/expense-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Pause,
  PlayCircle,
  LogOut,
  Zap,
  Receipt,
} from 'lucide-react'
import type { PosProduct } from './components/product-grid'
import type { PosCategory } from './components/category-tabs'

interface Props {
  products: PosProduct[]
  categories: PosCategory[]
  activeSession: { id: string } | null
  userId: string
  userProfile: { branch_id: string | null; organization_id: string }
  org: { vat_rate?: number; vat_enabled?: boolean; exchange_rate?: number }
}

export function PosClient({
  products,
  categories,
  activeSession,
  userId,
  userProfile,
  org,
}: Props) {
  const router = useRouter()
  const sessionId = usePosStore((s) => s.sessionId)
  const setSessionId = usePosStore((s) => s.setSessionId)
  const hasItems = usePosStore((s) => s.items.length > 0)
  const heldCount = usePosStore((s) => s.heldOrders.length)
  const holdCart = usePosStore((s) => s.holdCart)
  const clearCart = usePosStore((s) => s.clearCart)

  const [showOpen, setShowOpen] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [completedSale, setCompletedSale] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (activeSession && !sessionId) {
      setSessionId(activeSession.id)
    }
  }, [activeSession, sessionId, setSessionId])

  const hasSession = !!sessionId

  const handleHold = useCallback(() => {
    if (!hasItems) return
    const label = `Order ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    holdCart(label)
    toast.success('Order held')
  }, [hasItems, holdCart])

  const handleSaleComplete = useCallback(
    (sale: Record<string, unknown>) => {
      setShowCheckout(false)
      setCompletedSale(sale)
      setShowReceipt(true)
      clearCart()
      router.refresh()
    },
    [clearCart, router]
  )

  const handleCheckout = useCallback(() => setShowCheckout(true), [])
  const handleOpenSession = useCallback(() => setShowOpen(true), [])

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden bg-gray-50">
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {hasSession ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 font-medium shrink-0">
              <Zap className="h-3 w-3 mr-1" />
              Session Open
            </Badge>
          ) : (
            <Button size="sm" onClick={handleOpenSession} className="bg-[#1B2A4A] text-white shrink-0">
              Open Session
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto shrink-0">
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

            <Button
              variant="outline"
              size="sm"
              onClick={handleHold}
              disabled={!hasItems || !hasSession}
            >
              <Pause className="h-4 w-4 mr-1" />
              Hold
            </Button>

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

        <ProductBrowser
          products={products}
          categories={categories}
          hasSession={hasSession}
          onOpenSession={handleOpenSession}
        />
      </div>

      <div className="w-[360px] shrink-0 flex flex-col bg-white">
        <Cart org={org} onCheckout={handleCheckout} disabled={!hasSession} />
      </div>

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

      <HeldOrdersSheet open={showHeld} onOpenChange={setShowHeld} />

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
