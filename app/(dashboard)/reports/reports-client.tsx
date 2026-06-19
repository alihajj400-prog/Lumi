'use client'

import { useMemo } from 'react'
import { exchangeRateValue, formatUsd } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  CreditCard,
  Package,
  BarChart3,
  AlertTriangle,
} from 'lucide-react'

interface Sale {
  id: string
  total_usd: number
  total_lbp: number
  exchange_rate_used: number
  status: string
  created_at: string
  sale_items: { product_id: string; product_name: string; quantity: number; line_total_usd: number }[]
  payments: { method: string; amount_usd: number; amount_lbp: number }[]
}

interface Product {
  id: string
  name: string
  sku: string
  stock_qty: number
  reorder_level: number
  track_stock: boolean
}

const METHOD_LABEL: Record<string, string> = {
  cash_usd: 'Cash USD', cash_lbp: 'Cash LBP', card: 'Card',
  whish: 'Whish', omt: 'OMT', bob_finance: 'BoB Finance',
  bank_transfer: 'Bank Transfer', other: 'Other',
}

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ReportsClient({ sales, products }: { sales: Sale[]; products: Product[] }) {
  const completedSales = sales.filter(s => s.status === 'completed')

  // ── Daily sales (last 30 days) ──────────────────────────────────────────────
  const dailySales = useMemo(() => {
    const byDay: Record<string, { revenue: number; count: number }> = {}
    completedSales.forEach(s => {
      const day = s.created_at.slice(0, 10)
      if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 }
      byDay[day].revenue += s.total_usd
      byDay[day].count++
    })
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => ({ day, ...data }))
  }, [completedSales])

  const maxRevenue = Math.max(...dailySales.map(d => d.revenue), 1)

  // ── Payment methods breakdown ───────────────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    const byMethod: Record<string, number> = {}
    completedSales.forEach(s => {
      const rate = exchangeRateValue(s.exchange_rate_used ?? 90000)
      s.payments.forEach(p => {
        const usdEquivalent = p.amount_usd + Math.round(p.amount_lbp / rate / 100) * 100
        byMethod[p.method] = (byMethod[p.method] ?? 0) + usdEquivalent
      })
    })
    const total = Object.values(byMethod).reduce((s, v) => s + v, 0) || 1
    return Object.entries(byMethod)
      .sort(([, a], [, b]) => b - a)
      .map(([method, amount]) => ({
        method,
        label: METHOD_LABEL[method] ?? method,
        amount,
        pct: Math.round((amount / total) * 100),
      }))
  }, [completedSales])

  // ── Top products ────────────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const byProduct: Record<string, { name: string; qty: number; revenue: number }> = {}
    completedSales.forEach(s =>
      s.sale_items.forEach(item => {
        if (!byProduct[item.product_id]) {
          byProduct[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 }
        }
        byProduct[item.product_id].qty += item.quantity
        byProduct[item.product_id].revenue += item.line_total_usd
      })
    )
    return Object.entries(byProduct)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([id, data]) => ({ id, ...data }))
  }, [completedSales])

  const maxProductRevenue = Math.max(...topProducts.map(p => p.revenue), 1)

  // ── Low stock products ──────────────────────────────────────────────────────
  const lowStock = products.filter(
    p => p.track_stock && p.stock_qty <= p.reorder_level
  ).sort((a, b) => a.stock_qty - b.stock_qty)

  // ── Summary KPIs ────────────────────────────────────────────────────────────
  const totalRevenue = completedSales.reduce((s, sale) => s + sale.total_usd, 0)
  const totalTransactions = completedSales.length
  const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0

  const COLORS = ['#1B2A4A', '#E8A427', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f97316', '#06b6d4']

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Last 30 days · {completedSales.length} completed sales</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatUsd(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Transactions', value: totalTransactions.toLocaleString(), icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Sale', value: formatUsd(avgTransaction), icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Low Stock', value: lowStock.length.toString(), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`${kpi.bg} rounded-lg p-2.5`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily"><BarChart3 className="h-4 w-4 mr-1.5" />Daily Sales</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Payment Methods</TabsTrigger>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1.5" />Top Products</TabsTrigger>
          <TabsTrigger value="lowstock"><AlertTriangle className="h-4 w-4 mr-1.5" />Low Stock</TabsTrigger>
        </TabsList>

        {/* Daily Sales bar chart */}
        <TabsContent value="daily">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Daily Revenue (Last 30 Days)</h2>
            {dailySales.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No sales data</p>
            ) : (
              <div className="space-y-4">
                {/* Bar chart */}
                <div className="flex items-end gap-1 h-48 overflow-x-auto pb-2">
                  {dailySales.map(d => (
                    <div key={d.day} className="flex flex-col items-center gap-1 min-w-[28px]">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {formatUsd(d.revenue)}
                      </span>
                      <div
                        className="w-6 rounded-t"
                        style={{
                          height: `${Math.max(4, (d.revenue / maxRevenue) * 160)}px`,
                          backgroundColor: '#1B2A4A',
                          opacity: 0.85,
                        }}
                        title={`${formatDay(d.day)}: ${formatUsd(d.revenue)} (${d.count} sales)`}
                      />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {formatDay(d.day)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Table */}
                <table className="w-full text-sm mt-4">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b">
                      <th className="text-left py-2">Date</th>
                      <th className="text-right py-2">Sales</th>
                      <th className="text-right py-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailySales].reverse().map(d => (
                      <tr key={d.day} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 text-gray-600">{formatDay(d.day)}</td>
                        <td className="py-2 text-right text-gray-600">{d.count}</td>
                        <td className="py-2 text-right font-medium">{formatUsd(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Payment methods */}
        <TabsContent value="payments">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Payment Methods Breakdown</h2>
            {paymentBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No payment data</p>
            ) : (
              <div className="space-y-3">
                {paymentBreakdown.map((pm, i) => (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">{pm.label}</span>
                      <div className="text-right">
                        <span className="font-medium">{formatUsd(pm.amount)}</span>
                        <span className="text-gray-400 ml-2 text-xs">{pm.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pm.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Top products */}
        <TabsContent value="products">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Top 10 Products by Revenue</h2>
            {topProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No product data</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 truncate">{p.name}</span>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-medium">{formatUsd(p.revenue)}</span>
                          <span className="text-gray-400 ml-2 text-xs">{p.qty} sold</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(p.revenue / maxProductRevenue) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Low stock */}
        <TabsContent value="lowstock">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <Package className="h-10 w-10" />
                <p className="text-sm">All products are well stocked</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-right px-4 py-3">On Hand</th>
                    <th className="text-right px-4 py-3">Reorder At</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${p.stock_qty <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.stock_qty}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.reorder_level}</td>
                      <td className="px-4 py-3">
                        {p.stock_qty <= 0
                          ? <Badge className="bg-red-100 text-red-700 border-red-200">Out of Stock</Badge>
                          : <Badge className="bg-amber-100 text-amber-700 border-amber-200">Low Stock</Badge>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
