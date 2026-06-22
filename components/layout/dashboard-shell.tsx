'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { formatRate } from '@/lib/currency'
import type { UserProfile, Organization, Branch, OrgSettings } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Boxes,
  Truck,
  ClipboardList,
  History,
  BarChart3,
  Settings,
  Users,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Menu,
  UserCircle,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'stock_clerk', 'accountant'] },
  { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['admin', 'manager', 'stock_clerk'] },
  { href: '/categories', label: 'Categories', icon: Tag, roles: ['admin', 'manager'] },
  { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['admin', 'manager', 'stock_clerk'] },
  { href: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['admin', 'manager', 'accountant'] },
  { href: '/purchases', label: 'Purchases', icon: ClipboardList, roles: ['admin', 'manager', 'stock_clerk'] },
  { href: '/sales', label: 'Sales History', icon: History, roles: ['admin', 'manager', 'accountant'] },
  { href: '/customers', label: 'Customers', icon: UserCircle, roles: ['admin', 'manager', 'cashier', 'accountant'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager', 'accountant'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager', 'accountant'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['admin'] },
  { href: '/logs', label: 'Activity Log', icon: ScrollText, roles: ['admin', 'accountant'] },
]

interface Props {
  user: UserProfile
  organization: Organization
  branch: Branch | null
  settings: OrgSettings | null
  children: React.ReactNode
}

export function DashboardShell({ user, organization, branch, settings, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (settings) {
      setAuth({ user, organization, branch: branch!, settings })
    }
  }, [user, organization, branch, settings, setAuth])

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-2')}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#E8A427] text-white flex items-center justify-center font-bold text-sm">
          L
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#1B2A4A] truncate">LUMI</p>
            <p className="text-[10px] text-muted-foreground truncate">{organization.name}</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[#1B2A4A] text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* Exchange rate */}
      {!collapsed && (
        <div className="px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exchange Rate</p>
          <p className="text-sm font-semibold text-[#1B2A4A]">
            $1 = LL {formatRate(organization.exchange_rate)}
          </p>
        </div>
      )}

      {/* User menu */}
      <div className={cn('p-2', collapsed && 'flex justify-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              className={cn('w-full justify-start gap-3 h-auto py-2', collapsed && 'w-10 justify-center px-0')}
            >
              <div className="w-7 h-7 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="text-left min-w-0">
                  <p className="text-xs font-medium truncate">{user.full_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-white transition-all duration-200 flex-shrink-0',
          collapsed ? 'w-14' : 'w-56'
        )}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-16 -right-3 z-10 hidden lg:flex items-center justify-center w-6 h-6 rounded-full border bg-white shadow-sm hover:bg-muted transition-colors"
          style={{ left: collapsed ? '3.25rem' : '13.25rem' }}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 flex flex-col w-56 bg-white border-r">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-4 border-b bg-white px-4 flex-shrink-0">
          <button
            className="lg:hidden p-1 rounded hover:bg-muted"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Badge variant="outline" className="text-xs hidden sm:flex">
            {branch?.name ?? 'Main Branch'}
          </Badge>
          {organization.vat_enabled && (
            <Badge variant="secondary" className="text-xs hidden sm:flex">
              VAT {organization.vat_rate}%
            </Badge>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
