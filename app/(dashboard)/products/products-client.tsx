'use client'
import { useState, useTransition, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { formatUsd, formatLbp, usdToCents, lbpToPiasters } from '@/lib/currency'
import { emptyProductForm, UNITS, type ProductFormData } from '@/lib/store/product-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Archive, Upload, Loader2, Package, Filter, X, ImageIcon } from 'lucide-react'

interface Category { id: string; name: string; color: string | null }
interface Product {
  id: string; name: string; name_ar: string | null; sku: string; barcode: string | null
  category_id: string | null; unit: string; price_usd: number; price_lbp: number
  cost_usd: number; stock_qty: number; reorder_level: number; expiry_date: string | null
  track_stock: boolean; is_active: boolean; image_url: string | null; deleted_at: string | null
  categories?: Category | null
}

interface Props { initialProducts: Product[]; categories: Category[] }

function generateSku(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + Math.floor(Math.random() * 9000 + 1000)
}

export function ProductsClient({ initialProducts, categories }: Props) {
  const { organization, branch } = useAuthStore()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('active')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductFormData>(emptyProductForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [csvPending, setCsvPending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').includes(q)
      const matchCat = filterCat === 'all' || p.category_id === filterCat
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? p.is_active : !p.is_active)
      return matchSearch && matchCat && matchStatus
    })
  }, [products, search, filterCat, filterStatus])

  function openAdd() {
    setEditing(null)
    setForm(emptyProductForm)
    setImageFile(null)
    setImagePreview(null)
    setSheetOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name, name_ar: p.name_ar ?? '', sku: p.sku, barcode: p.barcode ?? '',
      category_id: p.category_id ?? '', unit: p.unit,
      price_usd: p.price_usd ? (p.price_usd / 100).toFixed(2) : '',
      price_lbp: p.price_lbp ? String(p.price_lbp / 100) : '',
      cost_usd: p.cost_usd ? (p.cost_usd / 100).toFixed(2) : '',
      reorder_level: String(p.reorder_level),
      expiry_date: p.expiry_date ?? '',
      track_stock: p.track_stock,
      is_active: p.is_active,
    })
    setImagePreview(p.image_url)
    setImageFile(null)
    setSheetOpen(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(productId: string): Promise<string | null> {
    if (!imageFile) return editing?.image_url ?? null
    const supabase = createClient()
    const ext = imageFile.name.split('.').pop()
    const path = `products/${productId}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
    if (error) { toast.error('Image upload failed'); return null }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.sku.trim()) { toast.error('SKU is required'); return }
    if (!form.unit) { toast.error('Unit is required'); return }
    if (!organization || !branch) return

    const payload = {
      organization_id: organization.id,
      branch_id: null,
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      unit: form.unit,
      price_usd: form.price_usd ? usdToCents(parseFloat(form.price_usd)) : 0,
      price_lbp: form.price_lbp ? lbpToPiasters(parseFloat(form.price_lbp)) : 0,
      cost_usd: form.cost_usd ? usdToCents(parseFloat(form.cost_usd)) : 0,
      reorder_level: parseFloat(form.reorder_level) || 0,
      expiry_date: form.expiry_date || null,
      track_stock: form.track_stock,
      is_active: form.is_active,
    }

    const supabase = createClient()

    startTransition(async () => {
      if (editing) {
        const imageUrl = await uploadImage(editing.id)
        const { error } = await supabase
          .from('products')
          .update({ ...payload, image_url: imageUrl })
          .eq('id', editing.id)
        if (error) { toast.error(error.message); return }
        setProducts(prev => prev.map(p =>
          p.id === editing.id
            ? { ...p, ...payload, image_url: imageUrl, categories: categories.find(c => c.id === payload.category_id) ?? null }
            : p
        ))
        toast.success('Product updated')
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error) { toast.error(error.message); return }
        const newProduct = data as unknown as Product
        const imageUrl = await uploadImage(newProduct.id)
        if (imageUrl) {
          await supabase.from('products').update({ image_url: imageUrl }).eq('id', newProduct.id)
          newProduct.image_url = imageUrl
        }
        newProduct.categories = categories.find(c => c.id === payload.category_id) ?? null
        setProducts(prev => [newProduct, ...prev])
        toast.success('Product created')
      }
      setSheetOpen(false)
    })
  }

  async function handleArchive() {
    if (!archiveId) return
    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', archiveId)
    if (error) { toast.error(error.message); return }
    setProducts(prev => prev.filter(p => p.id !== archiveId))
    setArchiveId(null)
    toast.success('Product archived')
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !organization) return
    setCsvPending(true)
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1)

    const supabase = createClient()
    let success = 0, failed = 0

    for (const row of rows) {
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const get = (key: string) => cols[headers.indexOf(key)] ?? ''
      const name = get('name')
      if (!name) continue
      const sku = get('sku') || generateSku(name)
      const catName = get('category')
      const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      const payload = {
        organization_id: organization.id,
        name,
        name_ar: get('name_ar') || null,
        sku: sku.toUpperCase(),
        barcode: get('barcode') || null,
        category_id: cat?.id ?? null,
        unit: get('unit') || 'piece',
        price_usd: get('price_usd') ? usdToCents(parseFloat(get('price_usd'))) : 0,
        price_lbp: get('price_lbp') ? lbpToPiasters(parseFloat(get('price_lbp'))) : 0,
        cost_usd: get('cost_usd') ? usdToCents(parseFloat(get('cost_usd'))) : 0,
        reorder_level: parseFloat(get('reorder_level')) || 0,
        track_stock: true,
        is_active: true,
      }
      const { error } = await supabase.from('products').insert(payload)
      if (error) failed++
      else success++
    }

    if (success > 0) {
      const { data } = await supabase.from('products').select('*, categories(id, name, color)').is('deleted_at', null).order('name')
      setProducts((data ?? []) as unknown as Product[])
    }
    setCsvPending(false)
    toast.success(`Imported ${success} products${failed ? ` (${failed} failed)` : ''}`)
    if (csvRef.current) csvRef.current.value = ''
  }

  const stockStatus = (p: Product) => {
    if (!p.track_stock) return null
    if (p.stock_qty <= 0) return <Badge variant="destructive" className="text-[10px]">Out</Badge>
    if (p.stock_qty <= p.reorder_level) return <Badge className="bg-amber-500 text-[10px]">Low</Badge>
    return <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">OK</Badge>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A]">Products</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {products.length} products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => csvRef.current?.click()} disabled={csvPending}>
            {csvPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import CSV
          </Button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <Button onClick={openAdd} className="bg-[#1B2A4A] hover:bg-[#243560]">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, barcode..."
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="absolute right-2.5 top-2.5" onClick={() => setSearch('')}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={filterCat} onValueChange={(v) => setFilterCat(v ?? 'all')}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'active')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Price (USD)</TableHead>
              <TableHead className="text-right">Price (LBP)</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No products found</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(p => (
                <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{p.name_ar}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{p.sku}</TableCell>
                  <TableCell>
                    {p.categories && (
                      <Badge
                        variant="outline"
                        style={{ borderColor: p.categories.color ?? undefined, color: p.categories.color ?? undefined }}
                        className="text-[10px]"
                      >
                        {p.categories.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{p.unit}</TableCell>
                  <TableCell className="text-right font-medium">{formatUsd(p.price_usd)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatLbp(p.price_lbp)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium">{p.stock_qty}</span>
                      {stockStatus(p)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => setArchiveId(p.id)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit Product' : 'Add Product'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {/* Image */}
            <div className="space-y-2">
              <Label>Product Image</Label>
              <div
                className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors relative overflow-hidden"
                onClick={() => fileRef.current?.click()}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to upload image</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Name (English) *</Label>
                <Input
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value
                    setForm(f => ({ ...f, name, sku: f.sku || generateSku(name) }))
                  }}
                  placeholder="e.g. Cheese Burger"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Name (Arabic)</Label>
                <Input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} dir="rtl" placeholder="الاسم بالعربي" />
              </div>
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="AUTO-1234" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="EAN-13" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v ?? 'piece' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (USD) $</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.price_usd}
                  onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Price (LBP) LL</Label>
                <Input
                  type="number" min="0"
                  value={form.price_lbp}
                  onChange={e => setForm(f => ({ ...f, price_lbp: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Cost (USD) $</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.cost_usd}
                  onChange={e => setForm(f => ({ ...f, cost_usd: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input
                  type="number" min="0"
                  value={form.reorder_level}
                  onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.track_stock} onCheckedChange={v => setForm(f => ({ ...f, track_stock: v }))} id="track_stock" />
                <Label htmlFor="track_stock">Track Stock</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} id="is_active" />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button className="flex-1 bg-[#1B2A4A] hover:bg-[#243560]" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveId} onOpenChange={o => !o && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              The product will be hidden from the POS and product list. Stock history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-amber-600 hover:bg-amber-700">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
