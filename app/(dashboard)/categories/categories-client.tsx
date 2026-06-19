'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react'

const PRESET_COLORS = [
  '#1B2A4A', '#E8A427', '#DC2626', '#16A34A', '#2563EB',
  '#9333EA', '#DB2777', '#EA580C', '#0891B2', '#65A30D',
]

interface Category {
  id: string
  name: string
  name_ar: string | null
  color: string | null
  icon: string | null
  display_order: number
}

interface Props {
  initialCategories: Category[]
}

const emptyForm = { name: '', name_ar: '', color: '#1B2A4A', icon: '' }

export function CategoriesClient({ initialCategories }: Props) {
  const { organization } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, name_ar: cat.name_ar ?? '', color: cat.color ?? '#1B2A4A', icon: cat.icon ?? '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!organization) return

    const supabase = createClient()
    startTransition(async () => {
      if (editing) {
        const { error } = await supabase
          .from('categories')
          .update({ name: form.name, name_ar: form.name_ar || null, color: form.color, icon: form.icon || null })
          .eq('id', editing.id)
        if (error) { toast.error(error.message); return }
        setCategories(prev => prev.map(c => c.id === editing.id ? { ...c, ...form, name_ar: form.name_ar || null, icon: form.icon || null } : c))
        toast.success('Category updated')
      } else {
        const display_order = categories.length + 1
        const { data, error } = await supabase
          .from('categories')
          .insert({ organization_id: organization.id, name: form.name, name_ar: form.name_ar || null, color: form.color, icon: form.icon || null, display_order })
          .select()
          .single()
        if (error) { toast.error(error.message); return }
        setCategories(prev => [...prev, data as unknown as Category])
        toast.success('Category created')
      }
      setDialogOpen(false)
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); return }
    setCategories(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    toast.success('Category deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        </div>
        <Button onClick={openAdd} className="bg-[#1B2A4A] hover:bg-[#243560]">
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <p className="text-muted-foreground">No categories yet.</p>
            <Button onClick={openAdd} variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add your first category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="group relative overflow-hidden">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: cat.color ?? '#1B2A4A' }}
              />
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{cat.name}</p>
                      {cat.name_ar && (
                        <p className="text-xs text-muted-foreground truncate" dir="rtl">{cat.name_ar}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setDeleteId(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name (English) *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Drinks"
              />
            </div>
            <div className="space-y-2">
              <Label>Name (Arabic)</Label>
              <Input
                value={form.name_ar}
                onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                placeholder="e.g. مشروبات"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#000' : 'transparent',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded-full border cursor-pointer p-0.5"
                  title="Custom color"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon (emoji or text)</Label>
              <Input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="e.g. 🍔 or 🥤"
                className="text-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1B2A4A] hover:bg-[#243560]"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Products in this category will have their category removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
