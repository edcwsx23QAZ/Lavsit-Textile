'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Check, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

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
  colorHex: string | null
  supplier: {
    id: string
    name: string
  }
}

export default function PalettePage() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnlyInStock, setShowOnlyInStock] = useState(false)
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null)

  const fetchFabrics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fabrics')
      if (!response.ok) throw new Error('Failed to fetch fabrics')
      const data = await response.json()
      setFabrics(data)
    } catch (error: any) {
      toast.error('Ошибка загрузки данных: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFabrics()
  }, [])

  // Фильтруем ткани по наличию
  const filteredFabrics = useMemo(() => {
    let filtered = fabrics

    if (showOnlyInStock) {
      filtered = filtered.filter(f => f.inStock === true)
    }

    // Сортируем по цвету (если есть colorHex) или по коллекции
    return filtered.sort((a, b) => {
      if (a.colorHex && b.colorHex) {
        // Сортируем по цвету (простая сортировка по HEX)
        return a.colorHex.localeCompare(b.colorHex)
      }
      // Иначе по коллекции и цвету
      if (a.collection !== b.collection) {
        return a.collection.localeCompare(b.collection)
      }
      return a.colorNumber.localeCompare(b.colorNumber)
    })
  }, [fabrics, showOnlyInStock])

  // Находим индекс выбранной ткани и получаем соседние
  const selectedIndex = selectedFabric
    ? filteredFabrics.findIndex(f => f.id === selectedFabric.id)
    : -1

  const displayFabrics = useMemo(() => {
    // Если ткань не выбрана, показываем все
    if (!selectedFabric || selectedIndex === -1) {
      return filteredFabrics
    }

    // Показываем 2 предыдущие, текущую и 2 последующие (всего 5 тканей)
    const start = Math.max(0, selectedIndex - 2)
    const end = Math.min(filteredFabrics.length, selectedIndex + 3)
    return filteredFabrics.slice(start, end)
  }, [filteredFabrics, selectedIndex, selectedFabric])

  const handleFabricClick = (fabric: Fabric) => {
    setSelectedFabric(fabric)
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Палитра цветов</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-only-in-stock"
                  checked={showOnlyInStock}
                  onCheckedChange={setShowOnlyInStock}
                />
                <Label htmlFor="show-only-in-stock">
                  Показывать только ткани в наличии
                </Label>
              </div>
              <div className="text-sm text-muted-foreground">
                Всего: {filteredFabrics.length} тканей
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 xl:grid-cols-24 gap-2">
            {displayFabrics.map((fabric) => (
              <FabricColorSquare
                key={fabric.id}
                fabric={fabric}
                isSelected={selectedFabric?.id === fabric.id}
                onClick={() => handleFabricClick(fabric)}
                onImageUpload={handleImageUpload}
              />
            ))}
          </div>
          {selectedFabric && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Выбранная ткань:</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedFabric(null)}
                >
                  Показать все
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Поставщик:</strong> {selectedFabric.supplier.name}</div>
                <div><strong>Коллекция:</strong> {selectedFabric.collection}</div>
                <div><strong>Цвет:</strong> {selectedFabric.colorNumber}</div>
                <div><strong>Категория:</strong> {selectedFabric.category ? `${selectedFabric.category} категория` : '-'}</div>
                <div><strong>Цена:</strong> {selectedFabric.price ? formatCurrency(selectedFabric.price) : '-'}</div>
                <div><strong>Цена за мп:</strong> {selectedFabric.pricePerMeter ? formatCurrency(selectedFabric.pricePerMeter) : '-'}</div>
                <div><strong>Наличие:</strong> {selectedFabric.inStock ? <Badge variant="success">Да</Badge> : <Badge variant="destructive">Нет</Badge>}</div>
                <div><strong>Метраж:</strong> {selectedFabric.meterage ? `${selectedFabric.meterage} м` : '-'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface FabricColorSquareProps {
  fabric: Fabric
  isSelected: boolean
  onClick: () => void
  onImageUpload: (fabricId: string, file: File) => void
}

function FabricColorSquare({ fabric, isSelected, onClick, onImageUpload }: FabricColorSquareProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const backgroundColor = fabric.colorHex || fabric.imageUrl 
    ? undefined 
    : '#cccccc' // Серый цвет по умолчанию

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Выберите файл изображения')
        return
      }
      onImageUpload(fabric.id, file)
      setShowUploadDialog(false)
    }
  }

  return (
    <div className="relative">
      <div
        className={`w-full aspect-square rounded border-2 cursor-pointer transition-all hover:scale-110 ${
          isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'
        }`}
        style={{ backgroundColor }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {fabric.imageUrl ? (
          <img
            src={fabric.imageUrl}
            alt={`${fabric.collection} ${fabric.colorNumber}`}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <ImageIcon className="h-6 w-6 text-gray-400" />
          </div>
        )}
        {fabric.inStock && (
          <div className="absolute top-1 right-1">
            <div className="w-3 h-3 bg-green-500 rounded-full border border-white" />
          </div>
        )}
      </div>
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
          <div><strong>{fabric.supplier.name}</strong></div>
          <div>{fabric.collection}</div>
          <div>{fabric.colorNumber}</div>
          {fabric.category && <div>Категория: {fabric.category}</div>}
          {fabric.pricePerMeter && <div>{formatCurrency(fabric.pricePerMeter)}/мп</div>}
        </div>
      )}
      {!fabric.imageUrl && (
        <Button
          size="sm"
          variant="outline"
          className="absolute bottom-0 left-0 right-0 w-full text-xs h-6"
          onClick={(e) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          <ImageIcon className="h-3 w-3 mr-1" />
          Добавить
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}

