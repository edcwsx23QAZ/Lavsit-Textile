'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ExclusionGroup {
  [collection: string]: Array<{
    id: string
    colorNumber: string
    excludedFromParsing: boolean
  }>
}

interface Exclusions {
  [supplierKey: string]: ExclusionGroup
}

export default function ExclusionsPage() {
  const [exclusions, setExclusions] = useState<Exclusions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchExclusions()
  }, [])

  const fetchExclusions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/exclusions')
      if (!response.ok) throw new Error('Failed to fetch exclusions')
      const data = await response.json()
      setExclusions(data.exclusions || {})
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (supplierKey: string, collection: string, fabricId: string, currentValue: boolean) => {
    setExclusions(prev => ({
      ...prev,
      [supplierKey]: {
        ...prev[supplierKey],
        [collection]: prev[supplierKey][collection].map(f =>
          f.id === fabricId ? { ...f, excludedFromParsing: !currentValue } : f
        ),
      },
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Собираем все измененные ткани
      const fabricIds: string[] = []
      const excludedValues: boolean[] = []

      Object.values(exclusions).forEach(supplierExclusions => {
        Object.values(supplierExclusions).forEach(colors => {
          colors.forEach(fabric => {
            fabricIds.push(fabric.id)
            excludedValues.push(fabric.excludedFromParsing)
          })
        })
      })

      if (fabricIds.length === 0) {
        toast.info('Нет данных для сохранения')
        return
      }

      // Группируем по значению excludedFromParsing для оптимизации
      const toExclude = fabricIds.filter((_, i) => excludedValues[i])
      const toInclude = fabricIds.filter((_, i) => !excludedValues[i])

      if (toExclude.length > 0) {
        await fetch('/api/exclusions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fabricIds: toExclude, excludedFromParsing: true }),
        })
      }

      if (toInclude.length > 0) {
        await fetch('/api/exclusions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fabricIds: toInclude, excludedFromParsing: false }),
        })
      }

      toast.success('Исключения сохранены')
      router.refresh()
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Исключения из парсинга</h1>
          <p className="text-muted-foreground">
            Управление тканями, которые исключены из автоматического парсинга
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Сохранить изменения
            </>
          )}
        </Button>
      </div>

      <div className="space-y-6">
        {Object.entries(exclusions).map(([supplierKey, collections]) => {
          const [supplierId, supplierName] = supplierKey.split('|')
          
          return (
            <Card key={supplierKey}>
              <CardHeader>
                <CardTitle>{supplierName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(collections).map(([collection, colors]) => (
                    <div key={collection} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">{collection}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {colors.map(fabric => (
                          <div key={fabric.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={fabric.id}
                              checked={fabric.excludedFromParsing}
                              onCheckedChange={() =>
                                handleToggle(supplierKey, collection, fabric.id, fabric.excludedFromParsing)
                              }
                            />
                            <label
                              htmlFor={fabric.id}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {fabric.colorNumber}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {Object.keys(exclusions).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Исключения не найдены
          </div>
        )}
      </div>
    </div>
  )
}
