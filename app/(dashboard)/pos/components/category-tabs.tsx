'use client'

import { memo, useCallback } from 'react'

export interface PosCategory {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface Props {
  categories: PosCategory[]
  selectedCat: string
  onSelect: (categoryId: string) => void
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCat,
  onSelect,
}: Props) {
  const handleAll = useCallback(() => onSelect('all'), [onSelect])

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100">
      <button
        type="button"
        onClick={handleAll}
        className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selectedCat === 'all'
            ? 'bg-[#1B2A4A] text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <CategoryTab
          key={cat.id}
          category={cat}
          selected={selectedCat === cat.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
})

const CategoryTab = memo(function CategoryTab({
  category,
  selected,
  onSelect,
}: {
  category: PosCategory
  selected: boolean
  onSelect: (categoryId: string) => void
}) {
  const handleClick = useCallback(() => onSelect(category.id), [category.id, onSelect])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
        selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      style={selected ? { backgroundColor: category.color ?? '#1B2A4A' } : undefined}
    >
      {category.icon && <span>{category.icon}</span>}
      {category.name}
    </button>
  )
})
