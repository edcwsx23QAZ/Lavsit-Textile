'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ExclusionsGroup {
  [supplierKey: string]: {
    [collection: string]: Array<{
      id: string
      colorNumber: string
      excludedFromParsing: boolean
    }>
  }
}

interface SuppliersExclusionsClientProps {
  grouped: ExclusionsGroup
}

export function SuppliersExclusionsClient({ grouped: initialGrouped }: SuppliersExclusionsClientProps) {
  const [grouped, setGrouped] = useState(initialGrouped)
  const [selectedFabrics, setSelectedFabrics] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const handleToggleFabric = (fabricId: string) => {
    setSelectedFabrics(prev => {
      const next = new Set(prev)
      if (next.has(fabricId)) {
        next.delete(fabricId)
      } else {
        next.add(fabricId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (selectedFabrics.size === 0) {
      toast.info('Выберите ткани для включения')
      return
    }

    try {
      setSaving(true)
      
      const response = await fetch('/api/exclusions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricIds: Array.from(selectedFabrics),
          excludedFromParsing: false,
        }),
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success(`Включено ${selectedFabrics.size} тканей`)
      router.refresh()
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Исключенные из парсинга ткани. Выберите ткани и нажмите "Сохранить" чтобы вернуть их в выборку.
        </p>
        <Button onClick={handleSave} disabled={saving || selectedFabrics.size === 0}>
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

      {Object.entries(grouped).map(([supplierKey, collections]) => {
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
                            checked={selectedFabrics.has(fabric.id)}
                            onCheckedChange={() => handleToggleFabric(fabric.id)}
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

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Исключения не найдены
        </div>
      )}
    </div>
  )
}





