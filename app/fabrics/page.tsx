'use client'

import { useEffect, useState, useRef } from 'react'
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
import { Search, RefreshCw, Download, Image as ImageIcon, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
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

export default function FabricsPage() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [showOnlyInStock, setShowOnlyInStock] = useState(false)

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      if (!response.ok) throw new Error('Failed to fetch suppliers')
      const data = await response.json()
      setSuppliers(data)
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

  // Фильтруем ткани по наличию
  const filteredFabrics = showOnlyInStock
    ? fabrics.filter(f => f.inStock === true)
    : fabrics

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    fetchFabrics()
  }, [search, selectedSupplierId])

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
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Сводная таблица тканей</CardTitle>
            <div className="flex items-center gap-4">
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
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedSupplierId === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSupplierId(null)}
              >
                Все ткани
              </Button>
              {suppliers.map((supplier) => (
                <Button
                  key={supplier.id}
                  variant={selectedSupplierId === supplier.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSupplierId(supplier.id)}
                >
                  {supplier.name}
                </Button>
              ))}
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
            <div className="relative overflow-auto max-h-[calc(100vh-300px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                  <TableRow>
                    <TableHead className="bg-background">Изображение</TableHead>
                    <TableHead className="bg-background">Поставщик</TableHead>
                    <TableHead className="bg-background">Коллекция</TableHead>
                    <TableHead className="bg-background">Номер цвета</TableHead>
                    <TableHead className="bg-background">Наличие</TableHead>
                    <TableHead className="bg-background">Метраж</TableHead>
                    <TableHead className="bg-background">Цена</TableHead>
                    <TableHead className="bg-background">Цена за мп</TableHead>
                    <TableHead className="bg-background">Категория ткани</TableHead>
                    <TableHead className="bg-background">Дата обновления</TableHead>
                    <TableHead className="bg-background">Дата поступления</TableHead>
                    <TableHead className="bg-background">Комментарий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFabrics.map((fabric) => (
                    <TableRow key={fabric.id}>
                      <TableCell>
                        {fabric.imageUrl ? (
                          <img
                            src={fabric.imageUrl}
                            alt={`${fabric.collection} ${fabric.colorNumber}`}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <ImageUploadButton
                            fabricId={fabric.id}
                            onUpload={handleImageUpload}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={fabric.supplier.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {fabric.supplier.name}
                        </a>
                      </TableCell>
                      <TableCell className="font-medium">
                        {fabric.collection}
                      </TableCell>
                      <TableCell>{fabric.colorNumber}</TableCell>
                      <TableCell>
                        {fabric.inStock === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : fabric.inStock ? (
                          <Badge variant="success">Да</Badge>
                        ) : (
                          <Badge variant="destructive">Нет</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {fabric.meterage
                          ? `${fabric.meterage} м`
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {fabric.price
                          ? formatCurrency(fabric.price)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {fabric.pricePerMeter
                          ? formatCurrency(fabric.pricePerMeter)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {fabric.category
                          ? <Badge variant="outline">{fabric.category} категория</Badge>
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{formatDate(fabric.lastUpdatedAt)}</TableCell>
                      <TableCell>
                        {fabric.nextArrivalDate
                          ? formatDate(fabric.nextArrivalDate)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {fabric.comment || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
        className="text-xs"
      >
        <ImageIcon className="h-3 w-3 mr-1" />
        Добавить
      </Button>
    </div>
  )
}

