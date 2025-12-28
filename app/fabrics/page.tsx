'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Search, RefreshCw, Download, Image as ImageIcon, Check, ChevronDown, ChevronUp, ArrowUpDown, Edit2, X, Save, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
// Textarea component - используем обычный textarea, если компонента нет
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

interface Supplier {
  id: string
  name: string
}

type SortField = 'collection' | 'colorNumber' | 'supplier' | 'meterage' | 'price' | 'inStock' | null
type SortDirection = 'asc' | 'desc'

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [showOnlyInStock, setShowOnlyInStock] = useState(false)
  const [collectionsCollapsed, setCollectionsCollapsed] = useState(false)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterFabricType, setFilterFabricType] = useState<string[]>([])
  const [filterCategory, setFilterCategory] = useState<number | null>(null)
  const [fabricTypeDropdownOpen, setFabricTypeDropdownOpen] = useState(false)
  const [editingField, setEditingField] = useState<{ fabricId: string; field: 'price' | 'fabricType' | 'description' } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [saving, setSaving] = useState<string | null>(null)
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<{ supplierId: string; collection: string; fabrics: Fabric[] } | null>(null)
  const [collectionFormData, setCollectionFormData] = useState({
    fabricType: '',
    category: '',
    price: '',
    description: '',
  })
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [pendingCollectionUpdate, setPendingCollectionUpdate] = useState<{ supplierId: string; collection: string; data: any } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'color' | 'collection'; fabricId?: string; supplierId: string; collection: string; colorNumber?: string } | null>(null)

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      if (!response.ok) throw new Error('Failed to fetch suppliers')
      const data = await response.json()
      // Сортируем поставщиков по алфавиту
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      setSuppliers(sorted)
    } catch (error: any) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchFabrics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) {
        params.append('search', search)
      }
      if (selectedSupplierId) {
        params.append('supplierId', selectedSupplierId)
      }
      const response = await fetch(`/api/fabrics?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch fabrics')
      const data = await response.json()
      setFabrics(data)
    } catch (error: any) {
      toast.error('Ошибка загрузки данных: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldEdit = (fabricId: string, field: 'price' | 'fabricType' | 'description', currentValue: any) => {
    setEditingField({ fabricId, field })
    setEditingValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '')
  }

  const handleFieldSave = async (fabricId: string, field: 'price' | 'fabricType' | 'description') => {
    try {
      setSaving(fabricId)
      
      const updateData: any = {}
      if (field === 'price') {
        updateData.price = editingValue.trim() || null
      } else if (field === 'fabricType') {
        updateData.fabricType = editingValue.trim() || null
      } else if (field === 'description') {
        updateData.description = editingValue.trim() || null
      }

      const response = await fetch(`/api/fabrics/${fabricId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update')
      }

      const updatedFabric = await response.json()
      
      // Обновляем ткань в локальном состоянии
      setFabrics(prev => prev.map(f => f.id === fabricId ? updatedFabric : f))
      
      toast.success('Данные успешно сохранены')
      setEditingField(null)
      setEditingValue('')
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(null)
    }
  }

  const handleFieldCancel = () => {
    setEditingField(null)
    setEditingValue('')
  }

  const handleCollectionClick = (supplierId: string, collection: string, fabrics: Fabric[]) => {
    // Берем данные из первой ткани коллекции (все ткани в коллекции должны иметь одинаковые значения)
    const firstFabric = fabrics[0]
    setSelectedCollection({ supplierId, collection, fabrics })
    setCollectionFormData({
      fabricType: firstFabric.fabricType || '',
      category: firstFabric.category?.toString() || '',
      price: firstFabric.price?.toString() || '',
      description: firstFabric.description || '',
    })
    setCollectionDialogOpen(true)
  }

  const handleCollectionSave = async () => {
    if (!selectedCollection) return

    try {
      const updateData: any = {}
      
      if (collectionFormData.fabricType !== undefined) {
        updateData.fabricType = collectionFormData.fabricType.trim() || null
      }
      if (collectionFormData.price !== undefined && collectionFormData.price !== '') {
        updateData.price = collectionFormData.price.trim() || null
      }
      if (collectionFormData.category !== undefined && collectionFormData.category !== '') {
        updateData.category = parseInt(collectionFormData.category) || null
      }
      if (collectionFormData.description !== undefined) {
        updateData.description = collectionFormData.description.trim() || null
      }

      // Сохраняем данные для диалога подтверждения
      setPendingCollectionUpdate({
        supplierId: selectedCollection.supplierId,
        collection: selectedCollection.collection,
        data: updateData,
      })
      
      // Показываем диалог подтверждения
      setCollectionDialogOpen(false)
      setShowApplyDialog(true)
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message)
    }
  }

  const handleApplyToAllColors = async (applyToAll: boolean) => {
    if (!pendingCollectionUpdate) return

    try {
      setSaving('collection')
      
      const response = await fetch('/api/fabrics/update-collection', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierId: pendingCollectionUpdate.supplierId,
          collection: pendingCollectionUpdate.collection,
          data: pendingCollectionUpdate.data,
          applyToAll: applyToAll,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update')
      }

      const result = await response.json()
      
      // Обновляем ткани в локальном состоянии
      // Перезагружаем данные с сервера для получения актуальных значений
      await fetchFabrics()
      
      toast.success(`Обновлено тканей: ${result.updated}`)
      setShowApplyDialog(false)
      setPendingCollectionUpdate(null)
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteClick = (type: 'color' | 'collection', fabric: Fabric, fabrics?: Fabric[]) => {
    if (type === 'collection' && fabrics) {
      setItemToDelete({
        type: 'collection',
        supplierId: fabric.supplier.id,
        collection: fabric.collection,
      })
    } else {
      setItemToDelete({
        type: 'color',
        fabricId: fabric.id,
        supplierId: fabric.supplier.id,
        collection: fabric.collection,
        colorNumber: fabric.colorNumber,
      })
    }
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async (action: 'remove' | 'exclude') => {
    if (!itemToDelete) return

    try {
      if (action === 'remove') {
        // Удаляем из текущей выборки (просто обновляем список)
        if (itemToDelete.type === 'collection') {
          // Удаляем все ткани коллекции из локального состояния
          setFabrics(prev => prev.filter(f => 
            !(f.supplier.id === itemToDelete.supplierId && f.collection === itemToDelete.collection)
          ))
        } else if (itemToDelete.fabricId) {
          // Удаляем конкретную ткань
          setFabrics(prev => prev.filter(f => f.id !== itemToDelete.fabricId))
        }
        toast.success(itemToDelete.type === 'collection' ? 'Коллекция удалена из выборки' : 'Цвет удален из выборки')
      } else {
        // Делаем исключением для парсинга
        const response = await fetch('/api/exclusions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: itemToDelete.supplierId,
            collection: itemToDelete.collection,
            colorNumber: itemToDelete.colorNumber,
            excludeCollection: itemToDelete.type === 'collection',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to exclude')
        }

        const data = await response.json()
        
        // Перезагружаем данные с сервера, чтобы исключенные ткани не показывались
        await fetchFabrics()

        toast.success(data.message || 'Исключение создано и сохранено')
      }
      
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message)
    }
  }

  const handleImageUpload = async (fabricId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fabricId', fabricId)

      const response = await fetch('/api/fabrics/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload image')
      }

      toast.success('Изображение загружено')
      fetchFabrics()
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    }
  }

  // Группируем ткани по коллекциям
  const groupedByCollection = useMemo(() => {
    const groups = new Map<string, Fabric[]>()
    fabrics.forEach(fabric => {
      const key = fabric.collection || 'Без коллекции'
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(fabric)
    })
    return groups
  }, [fabrics])

  // Получаем уникальные коллекции
  const uniqueCollections = useMemo(() => {
    return Array.from(new Set(fabrics.map(f => f.collection))).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [fabrics])

  // Фильтруем и сортируем ткани
  const filteredFabrics = useMemo(() => {
    let filtered = fabrics

    // Фильтр по наличию
    if (showOnlyInStock) {
      filtered = filtered.filter(f => f.inStock === true)
    }

    // Фильтр по выбранному поставщику
    if (selectedSupplierId) {
      filtered = filtered.filter(f => f.supplier.id === selectedSupplierId)
    }

    // Фильтр по поисковому запросу
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(f => 
        f.collection.toLowerCase().includes(searchLower) ||
        f.colorNumber.toLowerCase().includes(searchLower) ||
        f.supplier.name.toLowerCase().includes(searchLower)
      )
    }

    // Фильтр по типу ткани (множественный выбор)
    if (filterFabricType.length > 0) {
      filtered = filtered.filter(f => 
        f.fabricType && filterFabricType.includes(f.fabricType)
      )
    }

    // Фильтр по категории ткани
    if (filterCategory !== null) {
      filtered = filtered.filter(f => f.category === filterCategory)
    }

    // Сортировка
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any
        let bVal: any

        switch (sortField) {
          case 'collection':
            aVal = a.collection
            bVal = b.collection
            break
          case 'colorNumber':
            aVal = a.colorNumber
            bVal = b.colorNumber
            break
          case 'supplier':
            aVal = a.supplier.name
            bVal = b.supplier.name
            break
          case 'meterage':
            aVal = a.meterage ?? 0
            bVal = b.meterage ?? 0
            break
          case 'price':
            aVal = a.price ?? 0
            bVal = b.price ?? 0
            break
          case 'inStock':
            aVal = a.inStock ? 1 : 0
            bVal = b.inStock ? 1 : 0
            break
          default:
            return 0
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal, 'ru')
          return sortDirection === 'asc' ? comparison : -comparison
        } else {
          const comparison = (aVal ?? 0) - (bVal ?? 0)
          return sortDirection === 'asc' ? comparison : -comparison
        }
      })
    }

    return filtered
  }, [fabrics, showOnlyInStock, selectedSupplierId, search, filterFabricType, filterCategory, sortField, sortDirection])

  // Группируем ткани по коллекциям для отображения с заголовками
  const groupedFabrics = useMemo(() => {
    const groups = new Map<string, Fabric[]>()
    
    filteredFabrics.forEach(fabric => {
      const key = `${fabric.supplier.id}-${fabric.collection}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(fabric)
    })
    
    // Сортируем ткани внутри каждой группы по цвету
    groups.forEach((fabrics, key) => {
      fabrics.sort((a, b) => a.colorNumber.localeCompare(b.colorNumber, 'ru'))
    })
    
    return groups
  }, [filteredFabrics])

  // Получаем список групп для отображения
  const displayGroups = useMemo(() => {
    return Array.from(groupedFabrics.entries()).sort(([keyA], [keyB]) => {
      const [supplierIdA, collectionA] = keyA.split('-', 2)
      const [supplierIdB, collectionB] = keyB.split('-', 2)
      
      // Сначала сортируем по поставщику, потом по коллекции
      const supplierA = suppliers.find(s => s.id === supplierIdA)?.name || ''
      const supplierB = suppliers.find(s => s.id === supplierIdB)?.name || ''
      
      if (supplierA !== supplierB) {
        return supplierA.localeCompare(supplierB, 'ru')
      }
      
      return collectionA.localeCompare(collectionB, 'ru')
    })
  }, [groupedFabrics, suppliers])

  // При изменении групп разворачиваем все коллекции, если они не свернуты
  useEffect(() => {
    if (!collectionsCollapsed && displayGroups.length > 0) {
      setExpandedCollections(new Set(displayGroups.map(([key]) => key)))
    }
  }, [displayGroups.length, collectionsCollapsed])

  // Получаем уникальные типы ткани для фильтра
  const uniqueFabricTypes = useMemo(() => {
    const types = new Set<string>()
    fabrics.forEach(f => {
      if (f.fabricType) {
        types.add(f.fabricType)
      }
    })
    return Array.from(types).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [fabrics])

  // Счетчики на основе отфильтрованных данных
  const stats = useMemo(() => {
    const uniqueCollections = new Set(filteredFabrics.map(f => `${f.supplier.id}-${f.collection}`))
    const uniqueSuppliers = new Set(filteredFabrics.map(f => f.supplier.id))
    
    return {
      totalFabrics: filteredFabrics.length,
      totalCollections: uniqueCollections.size,
      totalSuppliers: uniqueSuppliers.size,
    }
  }, [filteredFabrics])

  // Функция для переключения развернутости коллекции
  const toggleCollection = (key: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    fetchFabrics()
  }, [search, selectedSupplierId])

  // Закрываем выпадающий список при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.fabric-type-dropdown')) {
        setFabricTypeDropdownOpen(false)
      }
    }
    if (fabricTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fabricTypeDropdownOpen])

  const handleRefresh = async () => {
    try {
      const response = await fetch('/api/suppliers/parse-all', {
        method: 'POST',
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to refresh')
      }
      const data = await response.json()
      
      if (data.successCount > 0) {
        toast.success(
          `Обновлено: ${data.successCount} из ${data.total} поставщиков${
            data.failedCount > 0 ? ` (ошибок: ${data.failedCount})` : ''
          }`
        )
      }
      
      if (data.failedCount > 0) {
        // Показываем детали ошибок
        const failedSuppliers = data.results
          .filter((r: any) => !r.success)
          .map((r: any) => `${r.supplierName}: ${r.error}`)
          .join('; ')
        toast.error(`Ошибки при обновлении: ${failedSuppliers}`, {
          duration: 5000,
        })
      }
      
      fetchFabrics()
    } catch (error: any) {
      toast.error('Ошибка обновления: ' + error.message)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="container mx-auto py-2 px-4 flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Сводная таблица тканей</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/fabrics/export')
                    if (!response.ok) throw new Error('Failed to download')
                    const blob = await response.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `all-fabrics-${new Date().toISOString().split('T')[0]}.xlsx`
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                    toast.success('Файл успешно скачан')
                  } catch (error: any) {
                    toast.error('Ошибка скачивания: ' + error.message)
                  }
                }}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Скачать список тканей
              </Button>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Обновить все данные
                </Button>
              </div>
            </div>
          </div>
          {/* Счетчики */}
          <div className="flex items-center gap-4 mt-2 pt-2 border-t flex-shrink-0">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Тканей</span>
              <span className="text-xl font-bold">{stats.totalFabrics}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Коллекций</span>
              <span className="text-xl font-bold">{stats.totalCollections}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Поставщиков</span>
              <span className="text-xl font-bold">{stats.totalSuppliers}</span>
            </div>
          </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
          <div className="mb-2 space-y-2 flex-shrink-0">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={selectedSupplierId === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSupplierId(null)}
              >
                Все ткани
              </Button>
              {/* Показываем только выбранного поставщика или всех, если не выбран */}
              {selectedSupplierId === null
                ? suppliers.map((supplier) => (
                    <Button
                      key={supplier.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSupplierId(supplier.id)}
                    >
                      {supplier.name}
                    </Button>
                  ))
                : suppliers
                    .filter(s => s.id === selectedSupplierId)
                    .map((supplier) => (
                      <Button
                        key={supplier.id}
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedSupplierId(null)}
                      >
                        {supplier.name} ✕
                      </Button>
                    ))}
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCollapsed = !collectionsCollapsed
                  if (newCollapsed) {
                    // Сворачиваем все коллекции
                    setExpandedCollections(new Set())
                  } else {
                    // Разворачиваем все коллекции
                    setExpandedCollections(new Set(displayGroups.map(([key]) => key)))
                  }
                  setCollectionsCollapsed(newCollapsed)
                }}
              >
                {collectionsCollapsed ? (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Развернуть категорию
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Свернуть категорию
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-only-in-stock"
                  checked={showOnlyInStock}
                  onCheckedChange={setShowOnlyInStock}
                />
                <label htmlFor="show-only-in-stock" className="text-sm cursor-pointer">
                  Показывать только ткани в наличии
                </label>
              </div>
              <div className="flex items-center gap-2 relative">
                <div className="relative fabric-type-dropdown">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFabricTypeDropdownOpen(!fabricTypeDropdownOpen)}
                    className="w-40 h-9 justify-between"
                  >
                    <span className="text-sm">
                      {filterFabricType.length === 0
                        ? 'Тип ткани...'
                        : filterFabricType.length === 1
                        ? filterFabricType[0]
                        : `Выбрано: ${filterFabricType.length}`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                  {fabricTypeDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-40 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                      {uniqueFabricTypes.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Нет типов ткани
                        </div>
                      ) : (
                        uniqueFabricTypes.map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={filterFabricType.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterFabricType([...filterFabricType, type])
                                } else {
                                  setFilterFabricType(filterFabricType.filter(t => t !== type))
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{type}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterCategory || ''}
                  onChange={(e) => setFilterCategory(e.target.value ? parseInt(e.target.value) : null)}
                  className="h-9 px-3 py-1 text-sm border border-input bg-background rounded-md"
                >
                  <option value="">Все категории</option>
                  {Array.from({ length: 16 }, (_, i) => i + 1).map(cat => (
                    <option key={cat} value={cat}>{cat} категория</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по коллекции или цвету..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : filteredFabrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ткани не найдены
            </div>
          ) : (
            <div className="relative overflow-auto flex-1 min-h-0" style={{ overflowX: 'hidden' }}>
              <Table className="text-xs table-fixed w-full">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                  <TableRow>
                    <TableHead className="bg-background w-14 p-1">Изобр.</TableHead>
                    <TableHead className="bg-background w-24 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Поставщик</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('supplier')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-28 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Коллекция</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('collection')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-24 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Цвет</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('colorNumber')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-20 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Наличие</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('inStock')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-20 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Метраж</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('meterage')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-20 p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Цена</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleSort('price')}
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                      </div>
                    </TableHead>
                    <TableHead className="bg-background w-16 p-1 text-xs">Категория</TableHead>
                    <TableHead className="bg-background w-28 p-1 text-xs">Тип ткани</TableHead>
                    <TableHead className="bg-background w-32 p-1 text-xs">Описание</TableHead>
                    <TableHead className="bg-background w-20 p-1 text-xs">Обновлено</TableHead>
                    <TableHead className="bg-background w-20 p-1 text-xs">Поступление</TableHead>
                    <TableHead className="bg-background w-40 p-1 text-xs">Комментарий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayGroups.map(([key, fabrics]) => {
                    const [supplierId, collection] = key.split('-', 2)
                    const supplier = suppliers.find(s => s.id === supplierId)
                    const isExpanded = expandedCollections.has(key) || !collectionsCollapsed
                    const firstFabric = fabrics[0]
                    
                    return (
                      <React.Fragment key={key}>
                        {/* Заголовок коллекции */}
                        <TableRow className="bg-muted/50 hover:bg-muted/70 h-10">
                          <TableCell colSpan={15} className="font-semibold p-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleCollection(key)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                <span 
                                  className="text-base cursor-pointer hover:underline"
                                  onClick={() => handleCollectionClick(supplierId, collection, fabrics)}
                                  title="Нажмите для редактирования коллекции"
                                >
                                  {supplier?.name} - {collection}
                                </span>
                                <Badge variant="outline" className="ml-2">
                                  {fabrics.length} {fabrics.length === 1 ? 'цвет' : fabrics.length < 5 ? 'цвета' : 'цветов'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 text-destructive hover:text-destructive ml-2"
                                  onClick={() => handleDeleteClick('collection', fabrics[0], fabrics)}
                                  title="Удалить коллекцию"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Ткани коллекции */}
                        {isExpanded && fabrics.map((fabric) => (
                          <TableRow key={fabric.id} className="h-12">
                            <TableCell className="p-1 w-14">
                              {fabric.imageUrl ? (
                                <img
                                  src={fabric.imageUrl}
                                  alt={`${fabric.collection} ${fabric.colorNumber}`}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <ImageUploadButton
                                  fabricId={fabric.id}
                                  onUpload={handleImageUpload}
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs w-24">
                              <a
                                href={fabric.supplier.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate block"
                                title={fabric.supplier.name}
                              >
                                {fabric.supplier.name}
                              </a>
                            </TableCell>
                            <TableCell className="font-medium p-1 text-xs">
                              <div className="flex items-center gap-1">
                                <span 
                                  className="cursor-pointer hover:underline"
                                  onClick={() => handleCollectionClick(fabric.supplier.id, fabric.collection, fabrics)}
                                  title="Нажмите для редактирования коллекции"
                                >
                                  {fabric.collection}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteClick('color', fabric)}
                                  title="Удалить цвет"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="p-1 text-xs">{fabric.colorNumber}</TableCell>
                            <TableCell className="p-1">
                              {fabric.inStock === null ? (
                                <span className="text-muted-foreground text-xs">-</span>
                              ) : fabric.inStock ? (
                                <Badge variant="success" className="text-xs">Да</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">Нет</Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs">
                              {fabric.meterage
                                ? `${fabric.meterage} м`
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {editingField?.fabricId === fabric.id && editingField?.field === 'price' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="h-8 w-24 text-sm"
                                    placeholder="Цена"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleFieldSave(fabric.id, 'price')
                                      } else if (e.key === 'Escape') {
                                        handleFieldCancel()
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleFieldSave(fabric.id, 'price')}
                                    disabled={saving === fabric.id}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={handleFieldCancel}
                                    disabled={saving === fabric.id}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 group"
                                  onClick={() => handleFieldEdit(fabric.id, 'price', fabric.price)}
                                  title="Нажмите для редактирования"
                                >
                                  <span className="text-xs">{fabric.price ? formatCurrency(fabric.price) : <span className="text-muted-foreground">-</span>}</span>
                                  <Edit2 className="h-2 w-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs">
                              {fabric.category
                                ? <Badge variant="outline" className="text-xs">{fabric.category}</Badge>
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="p-1 text-xs">
                              {editingField?.fabricId === fabric.id && editingField?.field === 'fabricType' ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="h-7 text-xs"
                                    placeholder="Тип ткани"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleFieldSave(fabric.id, 'fabricType')
                                      } else if (e.key === 'Escape') {
                                        handleFieldCancel()
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleFieldSave(fabric.id, 'fabricType')}
                                    disabled={saving === fabric.id}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={handleFieldCancel}
                                    disabled={saving === fabric.id}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div 
                                  className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 group"
                                  onClick={() => handleFieldEdit(fabric.id, 'fabricType', fabric.fabricType)}
                                  title="Нажмите для редактирования"
                                >
                                  <span className="text-xs">{fabric.fabricType || <span className="text-muted-foreground">-</span>}</span>
                                  <Edit2 className="h-2 w-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs">
                              {editingField?.fabricId === fabric.id && editingField?.field === 'description' ? (
                                <div className="flex flex-col gap-1">
                                  <textarea
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="min-h-[40px] w-full p-1 text-xs border rounded resize-y"
                                    placeholder="Описание"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        handleFieldCancel()
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-8 text-xs"
                                      onClick={() => handleFieldSave(fabric.id, 'description')}
                                      disabled={saving === fabric.id}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Сохранить
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs"
                                      onClick={handleFieldCancel}
                                      disabled={saving === fabric.id}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Отмена
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs"
                                      onClick={() => {
                                        if (expandedDescriptions.has(fabric.id)) {
                                          // Если развернуто, при клике редактируем
                                          handleFieldEdit(fabric.id, 'description', fabric.description)
                                        } else {
                                          // Если свернуто, разворачиваем
                                          setExpandedDescriptions(prev => {
                                            const newSet = new Set(prev)
                                            newSet.add(fabric.id)
                                            return newSet
                                          })
                                        }
                                      }}
                                    >
                                      {expandedDescriptions.has(fabric.id) ? (
                                        <>
                                          <Edit2 className="h-2 w-2 mr-1" />
                                          Редактировать
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-2 w-2 mr-1" />
                                          Показать
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  {expandedDescriptions.has(fabric.id) && (
                                    <div className="mt-1 p-1 bg-muted rounded text-xs whitespace-pre-wrap">
                                      {fabric.description}
                                    </div>
                                  )}
                                  {!fabric.description && (
                                    <div 
                                      className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 group inline-flex items-center gap-1"
                                      onClick={() => handleFieldEdit(fabric.id, 'description', '')}
                                      title="Нажмите для добавления описания"
                                    >
                                      <span className="text-muted-foreground">-</span>
                                      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="p-1 text-xs">{formatDate(fabric.lastUpdatedAt)}</TableCell>
                            <TableCell className="p-1 text-xs">
                              {fabric.nextArrivalDate
                                ? formatDate(fabric.nextArrivalDate)
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="p-1 text-xs">
                              {fabric.comment || (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить {itemToDelete?.type === 'collection' ? 'коллекцию' : 'строчку с цветом'} из текущей выборки или сделать исключением для парсинга?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)
              setItemToDelete(null)
            }}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteConfirm('remove')}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Удалить из текущей выборки
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDeleteConfirm('exclude')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Сделать исключением для парсинга
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Диалог редактирования коллекции */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Редактирование коллекции: {selectedCollection?.collection}
            </DialogTitle>
            <DialogDescription>
              Измените данные коллекции. После сохранения вы сможете применить изменения ко всем цветам.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fabricType">Тип ткани</Label>
              <Input
                id="fabricType"
                value={collectionFormData.fabricType}
                onChange={(e) => setCollectionFormData(prev => ({ ...prev, fabricType: e.target.value }))}
                placeholder="Введите тип ткани"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Категория ткани</Label>
              <Input
                id="category"
                type="number"
                min="1"
                max="16"
                value={collectionFormData.category}
                onChange={(e) => setCollectionFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Введите категорию (1-16)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Цена</Label>
              <Input
                id="price"
                value={collectionFormData.price}
                onChange={(e) => setCollectionFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Введите цену"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <textarea
                id="description"
                value={collectionFormData.description}
                onChange={(e) => setCollectionFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Введите описание"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCollectionDialogOpen(false)
                setSelectedCollection(null)
                setCollectionFormData({ fabricType: '', category: '', price: '', description: '' })
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleCollectionSave}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения применения ко всем цветам */}
      <AlertDialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Применить изменения?</AlertDialogTitle>
            <AlertDialogDescription>
              Применить описание ко всем цветам данной коллекции?
              <br />
              <br />
              Если выбрать "Да", все введенные данные (тип ткани, категория, цена, описание) будут применены ко всем цветам коллекции.
              <br />
              Если выбрать "Нет", изменится только описание коллекции.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowApplyDialog(false)
              setPendingCollectionUpdate(null)
            }}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApplyToAllColors(false)}
              disabled={saving === 'collection'}
            >
              Нет, только описание
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleApplyToAllColors(true)}
              disabled={saving === 'collection'}
            >
              Да, ко всем цветам
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}

interface ImageUploadButtonProps {
  fabricId: string
  onUpload: (fabricId: string, file: File) => void
}

function ImageUploadButton({ fabricId, onUpload }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Выберите файл изображения')
        return
      }
      onUpload(fabricId, file)
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs h-8 px-2"
      >
        <ImageIcon className="h-3 w-3" />
      </Button>
    </div>
  )
}

