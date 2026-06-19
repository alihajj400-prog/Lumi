import { create } from 'zustand'
import { PaymentMethod } from '@/lib/supabase/types'

export interface CartItem {
  product_id: string
  name: string
  name_ar: string | null
  sku: string
  unit: string
  price_usd: number   // cents
  price_lbp: number   // piasters
  quantity: number
  discount_usd: number // cents, per line
}

export interface HeldOrder {
  id: string
  label: string
  items: CartItem[]
  note: string
  heldAt: string
}

export interface PaymentEntry {
  method: PaymentMethod
  amount_usd: number  // cents
  amount_lbp: number  // piasters
  reference: string
}

interface PosState {
  // session
  sessionId: string | null
  setSessionId: (id: string) => void

  // cart
  items: CartItem[]
  note: string
  discount_usd: number  // cart-level discount in cents

  addItem: (item: Omit<CartItem, 'quantity' | 'discount_usd'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  updateLineDiscount: (productId: string, discountUsd: number) => void
  setCartDiscount: (discountUsd: number) => void
  setNote: (note: string) => void
  clearCart: () => void

  // held orders
  heldOrders: HeldOrder[]
  holdCart: (label: string) => void
  resumeHeld: (id: string) => void
  deleteHeld: (id: string) => void

  // computed (helpers — not reactive, call in render)
  subtotal: () => number       // cents
  taxAmount: (vatRate: number, vatEnabled: boolean) => number  // cents
  total: () => number          // cents (no tax)
}

export const usePosStore = create<PosState>((set, get) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  items: [],
  note: '',
  discount_usd: 0,

  addItem: (incoming) => {
    const items = get().items
    const existing = items.find(i => i.product_id === incoming.product_id)
    if (existing) {
      set({
        items: items.map(i =>
          i.product_id === incoming.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      })
    } else {
      set({ items: [...items, { ...incoming, quantity: 1, discount_usd: 0 }] })
    }
  },

  removeItem: (productId) =>
    set({ items: get().items.filter(i => i.product_id !== productId) }),

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set({
      items: get().items.map(i =>
        i.product_id === productId ? { ...i, quantity: qty } : i
      ),
    })
  },

  updateLineDiscount: (productId, discountUsd) =>
    set({
      items: get().items.map(i =>
        i.product_id === productId ? { ...i, discount_usd: discountUsd } : i
      ),
    }),

  setCartDiscount: (discountUsd) => set({ discount_usd: discountUsd }),
  setNote: (note) => set({ note }),

  clearCart: () => set({ items: [], note: '', discount_usd: 0 }),

  heldOrders: [],
  holdCart: (label) => {
    const { items, note } = get()
    if (items.length === 0) return
    const held: HeldOrder = {
      id: crypto.randomUUID(),
      label,
      items: [...items],
      note,
      heldAt: new Date().toISOString(),
    }
    set({ heldOrders: [...get().heldOrders, held] })
    get().clearCart()
  },

  resumeHeld: (id) => {
    const held = get().heldOrders.find(h => h.id === id)
    if (!held) return
    set({
      items: held.items,
      note: held.note,
      heldOrders: get().heldOrders.filter(h => h.id !== id),
    })
  },

  deleteHeld: (id) =>
    set({ heldOrders: get().heldOrders.filter(h => h.id !== id) }),

  subtotal: () => {
    const { items, discount_usd } = get()
    const linesTotal = items.reduce(
      (sum, i) => sum + i.price_usd * i.quantity - i.discount_usd,
      0
    )
    return Math.max(0, linesTotal - discount_usd)
  },

  taxAmount: (vatRate, vatEnabled) => {
    if (!vatEnabled) return 0
    return Math.round(get().subtotal() * (vatRate / 100))
  },

  total: () => get().subtotal(),
}))
