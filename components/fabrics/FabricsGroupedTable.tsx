'use client'

import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, formatMeterage } from '@/lib/utils'
import { Check, X, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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

interface FabricsGroupedTableProps {
  fabrics: Fabric[]
  categories: Array<{ id: string; category: number; price: number }>
  onUpdate: (id: string, fabric: Partial<Fabric>) => Promise<void>
  onExclude: (id: string, type: 'collection' | 'color') => void
  onExpandAll?: () => void
}

interface GroupedFabrics {
  [supplierId: string]: {
    supplierName: string
    collections: {
      [collection: string]: Fabric[]
    }
  }
}

export function FabricsGroupedTable({ fabrics, categories, onUpdate, onExclude, onExpandAll }: FabricsGroupedTableProps) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null)
  const [editingCollection, setEditingCollection] = useState<{ supplierId: string; collection: string; fabrics: Fabric[] } | null>(null)
  const [excludeDialog, setExcludeDialog] = useState<{ id: string; type: 'collection' | 'color'; collection: string; colorNumber?: string } | null>(null)
  const [applyToAll, setApplyToAll] = useState(false)

  // Группируем ткани по поставщику -> коллекции
  const grouped = useMemo(() => {
    const result: GroupedFabrics = {}
    
    fabrics.forEach(fabric => {
      const supplierId = fabric.supplier.id
      if (!result[supplierId]) {
        result[supplierId] = {
          supplierName: fabric.supplier.name,
          collections: {},
        }
      }
      if (!result[supplierId].collections[fabric.collection]) {
        result[supplierId].collections[fabric.collection] = []
      }
      result[supplierId].collections[fabric.collection].push(fabric)
    })

    return result
  }, [fabrics])

  const toggleCollection = (key: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    const allKeys = new Set<string>()
    Object.keys(grouped).forEach(supplierId => {
      Object.keys(grouped[supplierId].collections).forEach(collection => {
        allKeys.add(`${supplierId}-${collection}`)
      })
    })
    setExpandedCollections(allKeys)
  }

  const handleEditFabric = (fabric: Fabric) => {
    setEditingFabric(fabric)
    setApplyToAll(false)
  }

  const handleEditCollection = (supplierId: string, collection: string) => {
    const collectionFabrics = grouped[supplierId]?.collections[collection] || []
    setEditingCollection({ supplierId, collection, fabrics: collectionFabrics })
    setApplyToAll(false)
  }

  const handleSaveFabric = async () => {
    if (!editingFabric) return

    try {
      await onUpdate(editingFabric.id, {
        fabricType: editingFabric.fabricType,
        description: editingFabric.description,
        category: editingFabric.category,
        inStock: editingFabric.inStock,
        price: editingFabric.price,
      })
      setEditingFabric(null)
      toast.success('Ткань обновлена')
    } catch (error: any) {
      toast.error('Ошибка обновления: ' + error.message)
    }
  }

  const handleSaveCollection = async () => {
    if (!editingCollection) return

    try {
      const firstFabric = editingCollection.fabrics[0]
      if (!firstFabric) return

      if (applyToAll) {
        // Применяем ко всем цветам в коллекции
        await fetch('/api/fabrics/update-collection', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: editingCollection.supplierId,
            collection: editingCollection.collection,
            data: {
              fabricType: firstFabric.fabricType || null,
              description: firstFabric.description || null,
              category: firstFabric.category || null,
              price: firstFabric.price || null,
            },
            applyToAll: true,
          }),
        })
        toast.success('Изменения применены ко всем цветам коллекции')
      } else {
        // Сохраняем только описание коллекции (это не имеет смысла без applyToAll, но оставим для согласованности)
        toast.info('Изменения применены')
      }
      setEditingCollection(null)
      setApplyToAll(false)
    } catch (error: any) {
      toast.error('Ошибка обновления: ' + error.message)
    }
  }

  const handleExcludeClick = (fabric: Fabric, type: 'collection' | 'color') => {
    setExcludeDialog({
      id: fabric.id,
      type,
      collection: fabric.collection,
      colorNumber: type === 'color' ? fabric.colorNumber : undefined,
    })
  }

  const handleExcludeConfirm = async (excludeFromParsing: boolean) => {
    if (!excludeDialog) return

    try {
      if (excludeFromParsing) {
        // Добавляем в исключения для парсинга
        if (excludeDialog.type === 'collection') {
          await fetch('/api/exclusions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: fabrics.find(f => f.id === excludeDialog.id)?.supplier.id,
              collection: excludeDialog.collection,
              excludeCollection: true,
            }),
          })
        } else {
          await fetch('/api/exclusions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: fabrics.find(f => f.id === excludeDialog.id)?.supplier.id,
              collection: excludeDialog.collection,
              colorNumber: excludeDialog.colorNumber,
              excludeCollection: false,
            }),
          })
        }
        toast.success('Ткань добавлена в исключения')
      } else {
        // Просто скрываем из текущей выборки (не реализовано на бэкенде, можно добавить фильтр на клиенте)
        toast.info('Ткань скрыта из текущей выборки')
      }
      setExcludeDialog(null)
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message)
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleExpandAll} variant="outline" size="sm">
          Развернуть все коллекции
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-20">Изобр.</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Коллекция</TableHead>
              <TableHead>Цвет</TableHead>
              <TableHead>Тип ткани</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="text-right">Метраж</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Цена/м</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-center">В наличии</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([supplierId, supplierData]) =>
              Object.entries(supplierData.collections).map(([collection, collectionFabrics]) => {
                const collectionKey = `${supplierId}-${collection}`
                const isExpanded = expandedCollections.has(collectionKey)
                const firstFabric = collectionFabrics[0]

                return (
                  <React.Fragment key={collectionKey}>
                    {/* Строка коллекции */}
                    <TableRow className="bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCollection(collectionKey)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-medium">{supplierData.supplierName}</TableCell>
                      <TableCell className="font-medium">{collection}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          {collectionFabrics.length} {collectionFabrics.length === 1 ? 'цвет' : 'цветов'}
                        </span>
                      </TableCell>
                      <TableCell>{firstFabric.fabricType || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{firstFabric.description || '-'}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCollection(supplierId, collection)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExcludeClick(firstFabric, 'collection')}
                            className="h-8 w-8 p-0 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Цвета коллекции */}
                    {isExpanded && collectionFabrics.map((fabric) => (
                      <TableRow key={fabric.id}>
                        <TableCell></TableCell>
                        <TableCell>
                          {fabric.imageUrl ? (
                            <Image
                              src={fabric.imageUrl}
                              alt={`${fabric.collection} ${fabric.colorNumber}`}
                              width={40}
                              height={40}
                              className="rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded" />
                          )}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell>{fabric.colorNumber}</TableCell>
                        <TableCell>{fabric.fabricType || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{fabric.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          {fabric.meterage !== null ? formatMeterage(fabric.meterage) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {fabric.price !== null ? formatCurrency(fabric.price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {fabric.pricePerMeter !== null ? formatCurrency(fabric.pricePerMeter) : '-'}
                        </TableCell>
                        <TableCell>
                          {fabric.category ? `Кат. ${fabric.category}` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {fabric.inStock === true ? (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="h-3 w-3 mr-1" />
                              Да
                            </Badge>
                          ) : fabric.inStock === false ? (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              Нет
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {fabric.meterage !== null && fabric.meterage < 10 ? (
                            <span className="px-2 py-1 bg-yellow-200 text-yellow-900 text-xs font-medium rounded">
                              ВНИМАНИЕ, МАЛО!
                            </span>
                          ) : fabric.comment ? (
                            <span className="text-sm">{fabric.comment}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditFabric(fabric)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExcludeClick(fabric, 'color')}
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                )
              })
            )}

            {Object.keys(grouped).length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  Ткани не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Диалог редактирования ткани */}
      {editingFabric && (
        <Dialog open={!!editingFabric} onOpenChange={() => setEditingFabric(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать ткань</DialogTitle>
              <DialogDescription>
                {editingFabric.collection} {editingFabric.colorNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fabricType">Тип ткани</Label>
                  <Input
                    id="fabricType"
                    value={editingFabric.fabricType || ''}
                    onChange={(e) => setEditingFabric({ ...editingFabric, fabricType: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Категория</Label>
                  <Select
                    value={editingFabric.category?.toString() || ''}
                    onValueChange={(value) => setEditingFabric({ ...editingFabric, category: value ? parseInt(value) : null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без категории</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.category.toString()}>
                          Категория {cat.category} (до {cat.price.toLocaleString('ru')} ₽)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Описание</Label>
                <Input
                  id="description"
                  value={editingFabric.description || ''}
                  onChange={(e) => setEditingFabric({ ...editingFabric, description: e.target.value || null })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inStock">В наличии</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      checked={editingFabric.inStock === true}
                      onCheckedChange={(checked) => setEditingFabric({ ...editingFabric, inStock: checked ? true : false })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {editingFabric.inStock === true ? 'Да' : 'Нет'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="price">Цена (₽)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={editingFabric.price || ''}
                    onChange={(e) => setEditingFabric({ ...editingFabric, price: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingFabric(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveFabric}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог редактирования коллекции */}
      {editingCollection && (
        <Dialog open={!!editingCollection} onOpenChange={() => setEditingCollection(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать коллекцию</DialogTitle>
              <DialogDescription>
                {editingCollection.collection} ({editingCollection.fabrics.length} цветов)
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={applyToAll}
                  onCheckedChange={setApplyToAll}
                />
                <Label>Применить ко всем цветам в коллекции</Label>
              </div>
              
              {editingCollection.fabrics[0] && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="collectionFabricType">Тип ткани</Label>
                      <Input
                        id="collectionFabricType"
                        value={editingCollection.fabrics[0].fabricType || ''}
                        onChange={(e) => {
                          const updated = { ...editingCollection.fabrics[0], fabricType: e.target.value || null }
                          setEditingCollection({
                            ...editingCollection,
                            fabrics: editingCollection.fabrics.map(f => f.id === updated.id ? updated : f),
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="collectionCategory">Категория</Label>
                      <Select
                        value={editingCollection.fabrics[0].category?.toString() || 'none'}
                        onValueChange={(value) => {
                          const updated = { ...editingCollection.fabrics[0], category: value === 'none' ? null : parseInt(value) }
                          setEditingCollection({
                            ...editingCollection,
                            fabrics: editingCollection.fabrics.map(f => f.id === updated.id ? updated : f),
                          })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите категорию" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Без категории</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.category.toString()}>
                              Категория {cat.category} (до {cat.price.toLocaleString('ru')} ₽)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="collectionDescription">Описание</Label>
                    <Input
                      id="collectionDescription"
                      value={editingCollection.fabrics[0].description || ''}
                      onChange={(e) => {
                        const updated = { ...editingCollection.fabrics[0], description: e.target.value || null }
                        setEditingCollection({
                          ...editingCollection,
                          fabrics: editingCollection.fabrics.map(f => f.id === updated.id ? updated : f),
                        })
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="collectionPrice">Цена (₽)</Label>
                    <Input
                      id="collectionPrice"
                      type="number"
                      step="0.01"
                      value={editingCollection.fabrics[0].price || ''}
                      onChange={(e) => {
                        const updated = { ...editingCollection.fabrics[0], price: e.target.value ? parseFloat(e.target.value) : null }
                        setEditingCollection({
                          ...editingCollection,
                          fabrics: editingCollection.fabrics.map(f => f.id === updated.id ? updated : f),
                        })
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingCollection(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveCollection}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог исключения */}
      {excludeDialog && (
        <AlertDialog open={!!excludeDialog} onOpenChange={() => setExcludeDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Исключить {excludeDialog.type === 'collection' ? 'коллекцию' : 'цвет'}</AlertDialogTitle>
              <AlertDialogDescription>
                {excludeDialog.collection} {excludeDialog.colorNumber}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleExcludeConfirm(false)}
              >
                Исключить из текущей выборки
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleExcludeConfirm(true)}
              >
                Добавить в исключения для парсинга
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

