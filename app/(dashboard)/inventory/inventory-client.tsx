'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatUsd } from '@/lib/currency'
import { formatDate, formatDateTime } from '@/lib/format'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Package,
  Search,
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  ArrowUpCircle,
  ArrowDownCircle,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'

interface Product {
  id: string
  name: string
  name_ar: string | null
  sku: string
  unit: string
  stock_qty: number
  reorder_level: number
  cost_usd: number
  price_usd: number
  track_stock: boolean
  expiry_date: string | null
  image_url: string | null
  categories: { id: string; name: string; color: string | null } | null
}

interface Movement {
  id: string
  product_id: string
  movement_type: string
  quantity: number
  reason: string | null
  reference_type: string | null
  created_at: string
  products: { name: string; sku: string } | null
  users: { full_name: string } | null
}

interface Props {
  initialProducts: Product[]
  initialMovements: Movement[]
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: 'Sale',
  return: 'Return',
  purchase: 'Purchase',
  adjustment: 'Adjustment',
  waste: 'Waste',
  damage: 'Damage',
  opening: 'Opening Stock',
}

const ADJUSTMENT_TYPES = [
  { value: 'add', label: 'Add Stock', icon: '+' },
  { value: 'subtract', label: 'Remove Stock', icon: '−' },
  { value: 'set', label: 'Set Exact Qty', icon: '=' },
]

const ADJUSTMENT_REASONS = [
  'Stock Count',
  'Received Goods',
  'Damaged',
  'Expired',
  'Theft / Loss',
  'Opening Stock',
  'Other',
]

export function InventoryClient({ initialProducts, initialMovements }: Props) {
  const router = useRouter()
  const { user, branch, organization } = useAuthStore()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [movements, setMovements] = useState<Movement[]>(initialMovements)
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('all')

  // Adjustment dialog state
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjType, setAdjType] = useState<'add' | 'subtract' | 'set'>('add')
  const [adjQty, setAdjQty] = useState('')
  const [adjReason, setAdjReason] = useState('Stock Count')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjLoading, setAdjLoading] = useState(false)

  // Filtered products for Stock Levels tab
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.track_stock) return stockFilter === 'all' || stockFilter === 'untracked'
      const q = search.toLowerCase()
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      const matchFilter =
        stockFilter === 'all' ||
        (stockFilter === 'low' && p.stock_qty > 0 && p.stock_qty <= p.reorder_level) ||
        (stockFilter === 'out' && p.stock_qty <= 0) ||
        (stockFilter === 'ok' && p.stock_qty > p.reorder_level)
      return matchSearch && matchFilter
    }).filter(p => {
      if (stockFilter === 'untracked') return !p.track_stock
      return p.track_stock
    })
  }, [products, search, stockFilter])

  // Expiry products — those with expiry_date within 30 days or already expired
  const expiryProducts = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return products
      .filter(p => p.expiry_date)
      .map(p => ({ ...p, expiryDate: new Date(p.expiry_date!) }))
      .filter(p => p.expiryDate <= cutoff)
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
  }, [products])

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const q = movementSearch.toLowerCase()
      const matchSearch =
        !q ||
        (m.products?.name ?? '').toLowerCase().includes(q) ||
        (m.products?.sku ?? '').toLowerCase().includes(q) ||
        (m.reason ?? '').toLowerCase().includes(q)
      const matchType = movementTypeFilter === 'all' || m.movement_type === movementTypeFilter
      return matchSearch && matchType
    })
  }, [movements, movementSearch, movementTypeFilter])

  const openAdjust = (product: Product) => {
    setAdjustProduct(product)
    setAdjType('add')
    setAdjQty('')
    setAdjReason('Stock Count')
    setAdjNotes('')
  }

  const handleAdjust = async () => {
    if (!adjustProduct || !adjQty || !user) return
    const qty = parseFloat(adjQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setAdjLoading(true)
    try {
      const supabase = createClient()
      let newQty: number
      const current = adjustProduct.stock_qty

      if (adjType === 'add') newQty = current + qty
      else if (adjType === 'subtract') newQty = current - qty
      else newQty = qty // set

      // Update stock_qty on product
      const { error: prodErr } = await supabase
        .from('products')
        .update({ stock_qty: newQty })
        .eq('id', adjustProduct.id)
      if (prodErr) throw prodErr

      // Insert stock movement
      const movementQty = adjType === 'add' ? qty : adjType === 'subtract' ? -qty : newQty - current
      const { data: newMovement, error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          organization_id: organization?.id,
          branch_id: branch?.id,
          product_id: adjustProduct.id,
          movement_type: 'adjustment',
          quantity: movementQty,
          reason: adjNotes ? `${adjReason} — ${adjNotes}` : adjReason,
          reference_type: 'manual',
          performed_by: user.id,
        })
        .select('id, product_id, movement_type, quantity, reason, reference_type, created_at, products(name, sku), users(full_name)')
        .single()
      if (movErr) throw movErr

      // Update local state
      setProducts(prev =>
        prev.map(p => p.id === adjustProduct.id ? { ...p, stock_qty: newQty } : p)
      )
      setMovements(prev => [newMovement as any, ...prev])
      setAdjustProduct(null)
      toast.success(`Stock updated: ${adjustProduct.name} → ${newQty} ${adjustProduct.unit}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Adjustment failed')
    } finally {
      setAdjLoading(false)
    }
  }

  const stockStatusBadge = (p: Product) => {
    if (!p.track_stock) return <Badge variant="outline" className="text-gray-400">Untracked</Badge>
    if (p.stock_qty <= 0) return <Badge className="bg-red-100 text-red-700 border-red-200">Out of Stock</Badge>
    if (p.stock_qty <= p.reorder_level) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Low Stock</Badge>
    return <Badge className="bg-green-100 text-green-700 border-green-200">In Stock</Badge>
  }

  const movementIcon = (type: string, qty: number) => {
    if (qty > 0) return <ArrowUpCircle className="h-4 w-4 text-green-500 shrink-0" />
    return <ArrowDownCircle className="h-4 w-4 text-red-500 shrink-0" />
  }

  // Summary stats
  const totalTracked = products.filter(p => p.track_stock).length
  const outOfStock = products.filter(p => p.track_stock && p.stock_qty <= 0).length
  const lowStock = products.filter(p => p.track_stock && p.stock_qty > 0 && p.stock_qty <= p.reorder_level).length
  const expiringSoon = expiryProducts.length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Manage stock levels, adjustments, and movements</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tracked Products', value: totalTracked, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Out of Stock', value: outOfStock, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Low Stock', value: lowStock, icon: SlidersHorizontal, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Expiring Soon', value: expiringSoon, icon: CalendarClock, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`${card.bg} rounded-lg p-2.5`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stock">
        <TabsList className="mb-4">
          <TabsTrigger value="stock">
            <Package className="h-4 w-4 mr-1.5" />
            Stock Levels
          </TabsTrigger>
          <TabsTrigger value="expiry">
            <CalendarClock className="h-4 w-4 mr-1.5" />
            Expiry Alerts
            {expiringSoon > 0 && (
              <span className="ml-1.5 bg-purple-600 text-white rounded-full text-[10px] px-1.5 font-bold">
                {expiringSoon}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Movement Log
          </TabsTrigger>
        </TabsList>

        {/* Stock Levels Tab */}
        <TabsContent value="stock">
          <div className="bg-white rounded-xl border border-gray-200">
            {/* Filters */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={stockFilter} onValueChange={v => setStockFilter(v ?? 'all')}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="ok">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                  <SelectItem value="untracked">Untracked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Category</th>
                    <th className="text-right px-4 py-3">On Hand</th>
                    <th className="text-right px-4 py-3">Reorder At</th>
                    <th className="text-right px-4 py-3">Cost</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        No products match your filters
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-800">{p.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.categories ? (
                            <Badge
                              className="text-xs font-normal"
                              style={{
                                backgroundColor: p.categories.color ? `${p.categories.color}20` : '#f3f4f6',
                                color: p.categories.color ?? '#374151',
                                borderColor: p.categories.color ? `${p.categories.color}40` : '#e5e7eb',
                              }}
                            >
                              {p.categories.name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {p.track_stock
                            ? <span className={p.stock_qty <= 0 ? 'text-red-600' : p.stock_qty <= p.reorder_level ? 'text-amber-600' : 'text-gray-800'}>
                                {p.stock_qty % 1 === 0 ? p.stock_qty : p.stock_qty.toFixed(2)} {p.unit}
                              </span>
                            : <span className="text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {p.track_stock ? `${p.reorder_level} ${p.unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatUsd(p.cost_usd)}
                        </td>
                        <td className="px-4 py-3">{stockStatusBadge(p)}</td>
                        <td className="px-4 py-3">
                          {p.track_stock && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjust(p)}
                              className="h-7 text-xs"
                            >
                              Adjust
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Expiry Tab */}
        <TabsContent value="expiry">
          <div className="bg-white rounded-xl border border-gray-200">
            {expiryProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <CalendarClock className="h-10 w-10" />
                <p className="text-sm">No products expiring within 30 days</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-right px-4 py-3">On Hand</th>
                      <th className="text-left px-4 py-3">Expires</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryProducts.map(p => {
                      const now = new Date()
                      const daysLeft = Math.ceil((p.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      const expired = daysLeft <= 0
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {p.stock_qty} {p.unit}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(p.expiry_date!)}
                          </td>
                          <td className="px-4 py-3">
                            {expired ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>
                            ) : daysLeft <= 7 ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">{daysLeft}d left</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">{daysLeft}d left</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjust(p)}
                              className="h-7 text-xs"
                            >
                              Adjust
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Movement Log Tab */}
        <TabsContent value="movements">
          <div className="bg-white rounded-xl border border-gray-200">
            {/* Filters */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search product or reason..."
                  value={movementSearch}
                  onChange={e => setMovementSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={movementTypeFilter} onValueChange={v => setMovementTypeFilter(v ?? 'all')}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-left px-4 py-3">Reason</th>
                    <th className="text-left px-4 py-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        No movements found
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map(m => (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-800">{m.products?.name ?? '—'}</p>
                            <p className="text-xs text-gray-400 font-mono">{m.products?.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={`flex items-center justify-end gap-1 ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {movementIcon(m.movement_type, m.quantity)}
                            {m.quantity > 0 ? '+' : ''}{m.quantity % 1 === 0 ? m.quantity : m.quantity.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">
                          {m.reason ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {(m.users as any)?.full_name ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjustment Dialog */}
      <Dialog open={!!adjustProduct} onOpenChange={open => !open && setAdjustProduct(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>

          {adjustProduct && (
            <div className="space-y-4 py-1">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-800">{adjustProduct.name}</p>
                <p className="text-sm text-gray-500">
                  Current: <span className="font-medium text-gray-700">{adjustProduct.stock_qty} {adjustProduct.unit}</span>
                </p>
              </div>

              {/* Adjustment type */}
              <div className="space-y-1.5">
                <Label>Adjustment Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ADJUSTMENT_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setAdjType(t.value as any)}
                      className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                        adjType === t.value
                          ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <span className="block text-lg leading-none">{t.icon}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label>
                  {adjType === 'set' ? 'New Quantity' : 'Quantity'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.001}
                  placeholder="0"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                  autoFocus
                />
                {adjType !== 'set' && adjQty && !isNaN(parseFloat(adjQty)) && (
                  <p className="text-xs text-gray-500">
                    New qty: <span className="font-medium">
                      {adjType === 'add'
                        ? adjustProduct.stock_qty + parseFloat(adjQty)
                        : adjustProduct.stock_qty - parseFloat(adjQty)
                      } {adjustProduct.unit}
                    </span>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={adjReason} onValueChange={v => setAdjReason(v ?? 'Stock Count')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_REASONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="Additional notes..."
                  value={adjNotes}
                  onChange={e => setAdjNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustProduct(null)} disabled={adjLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjLoading || !adjQty}
              className="bg-[#1B2A4A] text-white"
            >
              {adjLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
