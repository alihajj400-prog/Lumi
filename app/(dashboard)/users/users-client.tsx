'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth-store'
import { formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, Pencil, UserX, Users, Loader2, Shield } from 'lucide-react'

type Role = 'admin' | 'manager' | 'cashier' | 'stock_clerk' | 'accountant'

interface User {
  id: string
  full_name: string
  role: Role
  branch_id: string | null
  is_active: boolean
  created_at: string
  branches: { id: string; name: string } | null
}

const ROLE_STYLES: Record<Role, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  manager: 'bg-purple-100 text-purple-700 border-purple-200',
  cashier: 'bg-blue-100 text-blue-700 border-blue-200',
  stock_clerk: 'bg-amber-100 text-amber-700 border-amber-200',
  accountant: 'bg-green-100 text-green-700 border-green-200',
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'stock_clerk', label: 'Stock Clerk' },
  { value: 'accountant', label: 'Accountant' },
]

interface Props {
  initialUsers: User[]
  branches: { id: string; name: string }[]
}

export function UsersClient({ initialUsers, branches }: Props) {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<Role>('cashier')
  const [editBranch, setEditBranch] = useState<string>('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.full_name.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditRole(u.role)
    setEditBranch(u.branch_id ?? '')
    setEditActive(u.is_active)
  }

  const handleSave = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          role: editRole,
          branch_id: editBranch || null,
          is_active: editActive,
        })
        .eq('id', editUser.id)
      if (error) throw error
      setUsers(prev => prev.map(u =>
        u.id === editUser.id
          ? { ...u, role: editRole, branch_id: editBranch || null, is_active: editActive, branches: branches.find(b => b.id === editBranch) ?? null }
          : u
      ))
      setEditUser(null)
      toast.success('User updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', deactivateTarget.id)
      if (error) throw error
      setUsers(prev => prev.map(u =>
        u.id === deactivateTarget.id ? { ...u, is_active: false } : u
      ))
      setDeactivateTarget(null)
      toast.success('User deactivated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to deactivate user')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400">To add users, use the Supabase dashboard</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-52" />
        </div>
        <Select value={roleFilter} onValueChange={v => setRoleFilter(v ?? 'all')}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Users className="h-10 w-10" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-[#1B2A4A]/10 flex items-center justify-center text-[#1B2A4A] font-bold text-sm shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{u.full_name}</p>
                        {u.id === currentUser?.id && (
                          <p className="text-xs text-gray-400">You</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`capitalize text-xs ${ROLE_STYLES[u.role] ?? ''}`}>{u.role.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.branches?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                      : <Badge className="bg-gray-100 text-gray-500 border-gray-200">Inactive</Badge>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {u.id !== currentUser?.id && u.is_active && (
                        <button onClick={() => setDeactivateTarget(u)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <SheetContent className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Edit User — {editUser?.full_name}</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6 pb-8">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={v => setEditRole((v ?? 'cashier') as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {editRole === 'admin' && 'Full access to all features and settings.'}
                {editRole === 'manager' && 'Access to reports, products, suppliers. Cannot manage users.'}
                {editRole === 'cashier' && 'POS only. Cannot view reports or manage inventory.'}
                {editRole === 'stock_clerk' && 'Inventory management. Cannot process sales.'}
                {editRole === 'accountant' && 'Read-only access to reports and sales history.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select value={editBranch} onValueChange={v => setEditBranch(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="No branch assigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No branch</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-gray-400 mt-0.5">Inactive users cannot log in</p>
              </div>
              <Switch
                checked={editActive}
                onCheckedChange={setEditActive}
                disabled={editUser?.id === currentUser?.id}
              />
            </div>

            <Separator />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button>
              <Button className="flex-1 bg-[#1B2A4A] text-white" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will not be able to log in. You can re-activate them by editing the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} disabled={deactivating} className="bg-red-600 hover:bg-red-700">
              {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
