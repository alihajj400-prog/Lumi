'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Pencil, Trash2, Loader2, Building2, Phone, Mail, User } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'

interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms: string | null
  currency: 'USD' | 'LBP'
  notes: string | null
  is_active: boolean
  created_at: string
}

interface FormData {
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
  payment_terms: string
  currency: 'USD' | 'LBP'
  notes: string
}

const emptyForm: FormData = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  payment_terms: '',
  currency: 'USD',
  notes: '',
}

interface Props {
  initialSuppliers: Supplier[]
}

export function SuppliersClient({ initialSuppliers }: Props) {
  const { organization } = useAuthStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.contact_person ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q)
    )
  })

  const openAdd = () => {
    setEditSupplier(null)
    setForm(emptyForm)
    setSheetOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditSupplier(s)
    setForm({
      name: s.name,
      contact_person: s.contact_person ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      payment_terms: s.payment_terms ?? '',
      currency: s.currency,
      notes: s.notes ?? '',
    })
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
        currency: form.currency,
        notes: form.notes.trim() || null,
      }

      if (editSupplier) {
        const { data, error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editSupplier.id)
          .select('*')
          .single()
        if (error) throw error
        setSuppliers(prev => prev.map(s => s.id === editSupplier.id ? data as Supplier : s))
        toast.success('Supplier updated')
      } else {
        const { data, error } = await supabase
          .from('suppliers')
          .insert({ ...payload, organization_id: organization?.id })
          .select('*')
          .single()
        if (error) throw error
        setSuppliers(prev => [...prev, data as Supplier])
        toast.success('Supplier added')
      }
      setSheetOpen(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('suppliers')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', deleteTarget.id)
      if (error) throw error
      setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success('Supplier removed')
      setDeleteTarget(null)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete supplier')
    } finally {
      setDeleting(false)
    }
  }

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd} className="bg-[#1B2A4A] text-white">
          <Plus className="h-4 w-4 mr-2" /> Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search suppliers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Supplier cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Building2 className="h-12 w-12" />
          <p className="text-sm">{search ? 'No suppliers match your search' : 'No suppliers yet'}</p>
          {!search && (
            <Button onClick={openAdd} variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Add your first supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-800">{s.name}</h3>
                  <Badge
                    variant="outline"
                    className="mt-1 text-xs"
                    style={{ borderColor: s.currency === 'USD' ? '#3b82f6' : '#8b5cf6', color: s.currency === 'USD' ? '#3b82f6' : '#8b5cf6' }}
                  >
                    {s.currency}
                  </Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600">
                {s.contact_person && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {s.contact_person}
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    {s.phone}
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.payment_terms && (
                  <div className="text-xs text-gray-400 pt-1">
                    Terms: {s.payment_terms}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editSupplier ? 'Edit Supplier' : 'Add Supplier'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-6 pb-8">
            <div className="space-y-1.5">
              <Label>Supplier Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tanmia Trading" />
            </div>

            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+961 1 234 567" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v ?? 'USD')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="LBP">LBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="supplier@example.com" />
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="City, District" />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="e.g. Net 30, Cash on Delivery" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Internal notes..."
                rows={3}
              />
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button className="flex-1 bg-[#1B2A4A] text-white" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editSupplier ? 'Save Changes' : 'Add Supplier'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be removed. Existing purchase orders linked to this supplier will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
