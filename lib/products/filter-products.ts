export interface FilterableProduct {
  id: string
  name: string
  sku: string
  barcode?: string | null
  category_id?: string | null
  is_active?: boolean
}

export function filterProductsByCategoryAndSearch<T extends FilterableProduct>(
  products: T[],
  categoryId: string,
  search: string,
  options?: { includeInactive?: boolean; statusFilter?: 'all' | 'active' | 'inactive' }
): T[] {
  const q = search.trim().toLowerCase()

  return products.filter((p) => {
    const matchCat = categoryId === 'all' || p.category_id === categoryId
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)

    let matchStatus = true
    if (options?.statusFilter === 'active') matchStatus = p.is_active !== false
    else if (options?.statusFilter === 'inactive') matchStatus = p.is_active === false

    return matchCat && matchSearch && matchStatus
  })
}
