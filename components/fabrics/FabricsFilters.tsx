'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, X } from 'lucide-react'

interface FabricsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  onClear: () => void
  fabricType: string
  onFabricTypeChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  supplierId: string
  onSupplierChange: (value: string) => void
  inStockOnly: boolean
  onInStockOnlyChange: (value: boolean) => void
  suppliers: Array<{ id: string; name: string }>
  categories: Array<{ id: string; category: number; price: number }>
  fabricTypes: string[]
}

export function FabricsFilters({
  search,
  onSearchChange,
  onClear,
  fabricType,
  onFabricTypeChange,
  description,
  onDescriptionChange,
  category,
  onCategoryChange,
  supplierId,
  onSupplierChange,
  inStockOnly,
  onInStockOnlyChange,
  suppliers,
  categories,
  fabricTypes,
}: FabricsFiltersProps) {
  const hasFilters = search || (fabricType && fabricType !== 'all') || description || (category && category !== 'all') || (supplierId && supplierId !== 'all') || inStockOnly

  return (
    <div className="space-y-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Фильтр по поставщику */}
        <div>
          <label className="text-sm font-medium mb-2 block">Поставщик</label>
          <Select value={supplierId} onValueChange={onSupplierChange}>
            <SelectTrigger>
              <SelectValue placeholder="Все поставщики" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все поставщики</SelectItem>
              {suppliers.map(supplier => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Поиск */}
        <div>
          <label className="text-sm font-medium mb-2 block">Поиск</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="По коллекции или цвету..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Фильтр по типу ткани */}
        <div>
          <label className="text-sm font-medium mb-2 block">Тип ткани</label>
          <Select value={fabricType || 'all'} onValueChange={onFabricTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Все типы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {fabricTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Фильтр по описанию */}
        <div>
          <label className="text-sm font-medium mb-2 block">Описание</label>
          <Input
            placeholder="Фильтр по описанию..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        {/* Фильтр по категории */}
        <div>
          <label className="text-sm font-medium mb-2 block">Категория</label>
          <Select value={category || 'all'} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.category.toString()}>
                  Категория {cat.category} (до {cat.price.toLocaleString('ru')} ₽)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Фильтр "Только в наличии" */}
        <div className="flex items-center space-x-2 pt-6">
          <Switch
            id="inStockOnly"
            checked={inStockOnly}
            onCheckedChange={onInStockOnlyChange}
          />
          <Label htmlFor="inStockOnly" className="text-sm font-medium cursor-pointer">
            Показывать только ткани в наличии
          </Label>
        </div>
      </div>

      {/* Кнопка очистки фильтров */}
      {hasFilters && (
        <div>
          <Button variant="outline" onClick={onClear}>
            <X className="h-4 w-4 mr-2" />
            Очистить фильтры
          </Button>
        </div>
      )}
    </div>
  )
}
