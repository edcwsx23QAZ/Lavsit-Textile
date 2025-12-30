'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { FabricsGroupedTable } from '@/components/fabrics/FabricsGroupedTable'
import { FabricsFilters } from '@/components/fabrics/FabricsFilters'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

interface Fabric {
  id: string
  collection: string
  colorNumber: string
  inStock: boolean | null
  meterage: number | null
  price: number | null
  pricePerMeter: number | null
  category: number | null
  imageUrl: string | null
  fabricType: string | null
  description: string | null
  lastUpdatedAt: Date
  nextArrivalDate: Date | null
  comment: string | null
  supplier: {
    id: string
    name: string
    websiteUrl: string
  }
}

interface FabricCategory {
  id: string
  category: number
  price: number
}

interface Supplier {
  id: string
  name: string
}

interface FabricsPageClientProps {
  initialFabrics: Fabric[]
  initialCategories: FabricCategory[]
  initialSuppliers: Supplier[]
}

export function FabricsPageClient({ 
  initialFabrics, 
  initialCategories,
  initialSuppliers,
}: FabricsPageClientProps) {
  const [fabrics, setFabrics] = useState(initialFabrics)
  const [search, setSearch] = useState('')
  const [fabricType, setFabricType] = useState('all')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'price' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Получаем уникальные типы тканей
  const fabricTypes = useMemo(() => {
    const types = new Set<string>()
    fabrics.forEach(f => {
      if (f.fabricType) types.add(f.fabricType)
    })
    return Array.from(types).sort()
  }, [fabrics])

  // Фильтрация в памяти
  const filteredFabrics = useMemo(() => {
    let filtered = fabrics

    if (supplierId && supplierId !== 'all') {
      filtered = filtered.filter(f => f.supplier.id === supplierId)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        f =>
          f.collection.toLowerCase().includes(searchLower) ||
          f.colorNumber.toLowerCase().includes(searchLower) ||
          f.supplier.name.toLowerCase().includes(searchLower)
      )
    }

    if (fabricType && fabricType !== 'all') {
      filtered = filtered.filter(f => f.fabricType === fabricType)
    }

    if (description) {
      const descLower = description.toLowerCase()
      filtered = filtered.filter(f => f.description?.toLowerCase().includes(descLower))
    }

    if (category && category !== 'all') {
      const catNum = parseInt(category)
      filtered = filtered.filter(f => f.category === catNum)
    }

    if (inStockOnly) {
      filtered = filtered.filter(f => f.inStock === true)
    }

    // Сортировка
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any
        let bVal: any

        if (sortField === 'name') {
          // Сортируем по названию коллекции с использованием localeCompare для правильной сортировки русского алфавита
          const aName = a.collection.toLowerCase()
          const bName = b.collection.toLowerCase()
          const comparison = aName.localeCompare(bName, 'ru')
          return sortDirection === 'asc' ? comparison : -comparison
        } else if (sortField === 'price') {
          // Сортируем по цене за метр
          aVal = a.pricePerMeter ?? 0
          bVal = b.pricePerMeter ?? 0
          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
          return 0
        } else {
          return 0
        }
      })
    }

    return filtered
  }, [fabrics, search, fabricType, description, category, supplierId, inStockOnly, sortField, sortDirection])

  // Подсчет коллекций
  const collectionsCount = useMemo(() => {
    const collections = new Set<string>()
    filteredFabrics.forEach(f => {
      collections.add(`${f.supplier.id}-${f.collection}`)
    })
    return collections.size
  }, [filteredFabrics])

  // Подсчет цветов в наличии
  const inStockColorsCount = useMemo(() => {
    return filteredFabrics.filter(f => f.inStock === true).length
  }, [filteredFabrics])

  const handleClearFilters = () => {
    setSearch('')
    setFabricType('all')
    setDescription('')
    setCategory('all')
    setSupplierId('all')
    setInStockOnly(false)
    setSortField(null)
    setSortDirection('asc')
  }

  const handleUpdate = useCallback(async (id: string, updates: Partial<Fabric>) => {
    try {
      const response = await fetch(`/api/fabrics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update')
      }

      const updated = await response.json()
      setFabrics(prev => prev.map(f => f.id === id ? updated : f))
    } catch (error: any) {
      throw error
    }
  }, [])

  const handleExclude = useCallback((id: string, type: 'collection' | 'color') => {
    // Удаляем из текущего списка (исключаем из выборки)
    setFabrics(prev => {
      if (type === 'collection') {
        const fabric = prev.find(f => f.id === id)
        if (!fabric) return prev
        return prev.filter(f => !(f.supplier.id === fabric.supplier.id && f.collection === fabric.collection))
      } else {
        return prev.filter(f => f.id !== id)
      }
    })
  }, [])

  return (
    <>
      <FabricsFilters
        search={search}
        onSearchChange={setSearch}
        onClear={handleClearFilters}
        fabricType={fabricType}
        onFabricTypeChange={setFabricType}
        description={description}
        onDescriptionChange={setDescription}
        category={category}
        onCategoryChange={setCategory}
        supplierId={supplierId}
        onSupplierChange={setSupplierId}
        inStockOnly={inStockOnly}
        onInStockOnlyChange={setInStockOnly}
        suppliers={initialSuppliers}
        categories={initialCategories}
        fabricTypes={fabricTypes}
      />

      {/* Счетчики и сортировка */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Показано: <span className="font-medium text-foreground">{filteredFabrics.length.toLocaleString('ru')}</span> тканей в{' '}
          <span className="font-medium text-foreground">{collectionsCount.toLocaleString('ru')}</span> коллекциях,{' '}
          <span className="font-medium text-foreground">{inStockColorsCount.toLocaleString('ru')}</span> цветов в наличии
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                // Подготавливаем данные для экспорта (только нужные поля)
                const exportData = filteredFabrics.map(f => ({
                  supplier: { name: f.supplier.name },
                  collection: f.collection,
                  colorNumber: f.colorNumber,
                  fabricType: f.fabricType,
                  description: f.description,
                  meterage: f.meterage,
                  price: f.price,
                  pricePerMeter: f.pricePerMeter,
                  category: f.category,
                  inStock: f.inStock,
                }))

                const response = await fetch('/api/fabrics/export', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ fabrics: exportData }),
                })

                if (!response.ok) {
                  throw new Error('Ошибка экспорта')
                }

                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `fabrics-${new Date().toISOString().split('T')[0]}.xlsx`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
                
                toast.success('Ткани успешно экспортированы')
              } catch (error: any) {
                console.error('Error exporting fabrics:', error)
                toast.error('Ошибка при экспорте тканей')
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Скачать все ткани в Excel
          </Button>
          <span className="text-sm text-muted-foreground">Сортировка:</span>
          <Select
            value={sortField || 'none'}
            onValueChange={(value) => {
              if (value === 'none') {
                setSortField(null)
              } else {
                setSortField(value as 'name' | 'price')
              }
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Без сортировки" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без сортировки</SelectItem>
              <SelectItem value="name">По названию</SelectItem>
              <SelectItem value="price">По стоимости</SelectItem>
            </SelectContent>
          </Select>
          {sortField && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </Button>
          )}
        </div>
      </div>

      <FabricsGroupedTable
        fabrics={filteredFabrics}
        categories={initialCategories}
        onUpdate={handleUpdate}
        onExclude={handleExclude}
      />

      {filteredFabrics.length === 0 && fabrics.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          По фильтрам ничего не найдено
        </div>
      )}
    </>
  )
}
