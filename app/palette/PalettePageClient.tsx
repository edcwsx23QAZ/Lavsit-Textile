'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Fabric {
  id: string
  collection: string
  colorNumber: string
  colorHex: string | null
  imageUrl: string | null
  supplier: {
    name: string
  }
}

interface PalettePageClientProps {
  initialFabrics: Fabric[]
}

export function PalettePageClient({ initialFabrics }: PalettePageClientProps) {
  const [fabrics] = useState(initialFabrics)
  const [search, setSearch] = useState('')

  // Фильтруем только ткани с цветами и применяем поиск
  const filteredFabrics = useMemo(() => {
    let filtered = fabrics.filter(f => f.colorHex)
    
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        f =>
          f.collection.toLowerCase().includes(searchLower) ||
          f.colorNumber.toLowerCase().includes(searchLower) ||
          f.supplier.name.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  }, [fabrics, search])

  return (
    <>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по коллекции, цвету или поставщику..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredFabrics.map((fabric) => (
          <Card key={fabric.id} className="overflow-hidden">
            <CardContent className="p-0">
              {fabric.imageUrl ? (
                <div className="relative aspect-square">
                  <Image
                    src={fabric.imageUrl}
                    alt={`${fabric.collection} ${fabric.colorNumber}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className="aspect-square w-full"
                  style={{ backgroundColor: fabric.colorHex || '#ccc' }}
                />
              )}
              <div className="p-3">
                <div className="text-xs font-medium truncate">{fabric.collection}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {fabric.colorNumber}
                </div>
                {fabric.colorHex && (
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: fabric.colorHex }}
                    />
                    <span className="text-xs text-muted-foreground">{fabric.colorHex}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFabrics.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {search ? `По запросу "${search}" ничего не найдено` : 'Ткани с цветами не найдены'}
        </div>
      )}
    </>
  )
}




