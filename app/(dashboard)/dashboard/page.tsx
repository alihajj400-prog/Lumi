import { createClient } from '@/lib/supabase/server'
import { formatUsd, formatLbp } from '@/lib/currency'
import { formatDateTime } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, ShoppingBag, DollarSign, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const [salesResult, lowStockResult, recentSalesResult] = await Promise.all([
    supabase
      .from('sales')
      .select('total_usd, total_lbp')
      .gte('created_at', todayStr)
      .eq('status', 'completed'),
    supabase
      .from('products')
      .select('id, name, sku, stock_qty, reorder_level, unit')
      .filter('track_stock', 'eq', true)
      .filter('is_active', 'eq', true)
      .filter('deleted_at', 'is', null),
    supabase
      .from('sales')
      .select('id, sale_number, total_usd, status, created_at, cashier:users!cashier_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const sales = (salesResult.data ?? []) as unknown as Array<{ total_usd: number; total_lbp: number }>
  const allProducts = (lowStockResult.data ?? []) as unknown as Array<{ id: string; name: string; sku: string; stock_qty: number; reorder_level: number; unit: string }>
  const recentSales = (recentSalesResult.data ?? []) as unknown as Array<{
    id: string
    sale_number: string
    total_usd: number
    status: string
    created_at: string
    cashier: { full_name: string } | null
  }>

  const totalSalesUsd = sales.reduce((sum, s) => sum + s.total_usd, 0)
  const totalSalesLbp = sales.reduce((sum, s) => sum + s.total_lbp, 0)
  const transactionCount = sales.length

  const lowStockItems = allProducts.filter(
    (p) => p.stock_qty <= p.reorder_level
  )

  const kpis = [
    {
      title: "Today's Sales",
      value: formatUsd(totalSalesUsd),
      sub: formatLbp(totalSalesLbp),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Transactions',
      value: transactionCount.toString(),
      sub: 'completed today',
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Low Stock Items',
      value: lowStockItems.length.toString(),
      sub: 'need reordering',
      icon: AlertTriangle,
      color: lowStockItems.length > 0 ? 'text-amber-600' : 'text-gray-400',
      bg: lowStockItems.length > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
    {
      title: 'Avg Transaction',
      value: transactionCount > 0 ? formatUsd(Math.round(totalSalesUsd / transactionCount)) : '$0.00',
      sub: 'per sale today',
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{kpi.title}</p>
                    <p className="text-xl font-bold text-[#1B2A4A]">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentSales.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No transactions yet today
              </div>
            ) : (
              <div className="divide-y">
                {recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{sale.sale_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.cashier?.full_name ?? 'Unknown'} · {formatDateTime(sale.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatUsd(sale.total_usd)}</p>
                      <Badge
                        variant={sale.status === 'completed' ? 'default' : 'destructive'}
                        className="text-[10px]"
                      >
                        {sale.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Low Stock Alerts
              {lowStockItems.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {lowStockItems.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                All stock levels are healthy
              </div>
            ) : (
              <div className="divide-y">
                {lowStockItems.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${product.stock_qty <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {product.stock_qty} {product.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">min {product.reorder_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
