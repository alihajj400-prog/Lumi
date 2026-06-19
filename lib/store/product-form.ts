export interface ProductFormData {
  name: string
  name_ar: string
  sku: string
  barcode: string
  category_id: string
  unit: string
  price_usd: string
  price_lbp: string
  cost_usd: string
  reorder_level: string
  expiry_date: string
  track_stock: boolean
  is_active: boolean
}

export const emptyProductForm: ProductFormData = {
  name: '',
  name_ar: '',
  sku: '',
  barcode: '',
  category_id: '',
  unit: 'piece',
  price_usd: '',
  price_lbp: '',
  cost_usd: '',
  reorder_level: '0',
  expiry_date: '',
  track_stock: true,
  is_active: true,
}

export const UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'liter', label: 'Liter' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'carton', label: 'Carton' },
]
