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
  [supplierKey: string]: {
    [collection: string]: Array<{
      id: string
      colorNumber: string
      excludedFromParsing: boolean
    }>
  }
}

interface ExclusionState {
  [fabricId: string]: boolean
}

export default function ExclusionsPage() {
  const router = useRouter()
  const [exclusions, setExclusions] = useState<ExclusionGroup>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exclusionState, setExclusionState] = useState<ExclusionState>({})

  const fetchExclusions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/exclusions')
      if (!response.ok) throw new Error('Failed to fetch exclusions')
      const data = await response.json()
      setExclusions(data.exclusions || {})
      
      // Инициализируем состояние чекбоксов
      const state: ExclusionState = {}
      Object.values(data.exclusions || {}).forEach((collections: any) => {
        Object.values(collections).forEach((colors: any) => {
          colors.forEach((color: any) => {
            state[color.id] = color.excludedFromParsing
          })
        })
      })
      setExclusionState(state)
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExclusions()
  }, [])

  const handleCheckboxChange = (fabricId: string, checked: boolean) => {
    setExclusionState(prev => ({
      ...prev,
      [fabricId]: checked,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Находим все ткани, у которых снят чекбокс (нужно отменить исключение)
      const toInclude: string[] = []
      
      // Проходим по всем исключениям и находим те, у которых чекбокс снят
      Object.values(exclusions).forEach((collections: any) => {
        Object.values(collections).forEach((colors: any) => {
          colors.forEach((color: any) => {
            const currentState = exclusionState[color.id] ?? true // По умолчанию все исключены
            // Если чекбокс снят (false), значит нужно отменить исключение
            if (!currentState) {
              toInclude.push(color.id)
            }
          })
        })
      })

      // Отменяем исключения для тканей с снятыми чекбоксами
      if (toInclude.length > 0) {
        const response = await fetch('/api/exclusions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fabricIds: toInclude,
            excludedFromParsing: false,
          }),
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to include')
        }
      } else {
        toast.info('Нет изменений для сохранения')
        return
      }

      toast.success(`Исключение отменено для ${toInclude.length} ${toInclude.length === 1 ? 'ткани' : 'тканей'}`)
      fetchExclusions()
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = () => {
    // Проверяем, есть ли ткани с снятыми чекбоксами (которые нужно включить обратно)
    let hasChanges = false
    Object.values(exclusions).forEach((collections: any) => {
      Object.values(collections).forEach((colors: any) => {
        colors.forEach((color: any) => {
          const currentState = exclusionState[color.id] ?? true // По умолчанию все исключены
          // Если чекбокс снят (false), значит есть изменения
          if (!currentState) {
            hasChanges = true
          }
        })
      })
    })
    return hasChanges
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Загрузка исключений...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supplierKeys = Object.keys(exclusions).sort()

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Исключения парсинга</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/suppliers')}
              >
                Назад к поставщикам
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {supplierKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Исключения не найдены
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                Все ткани в списке уже исключены из парсинга. Снимите чекбокс у тех тканей, для которых нужно отменить исключение, и нажмите "Сохранить".
              </div>
            <div className="space-y-6">
              {supplierKeys.map((supplierKey) => {
                const [supplierId, supplierName] = supplierKey.split('|')
                const collections = exclusions[supplierKey]
                const collectionKeys = Object.keys(collections).sort()

                return (
                  <div key={supplierKey} className="border rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Badge variant="outline">{supplierName}</Badge>
                    </h3>
                    <div className="space-y-4 ml-4">
                      {collectionKeys.map((collection) => {
                        const colors = collections[collection]
                        return (
                          <div key={collection} className="border-l-2 pl-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Badge variant="secondary">{collection}</Badge>
                            </h4>
                            <div className="space-y-2 ml-4">
                              {colors.map((color) => (
                                <div
                                  key={color.id}
                                  className="flex items-center gap-2 py-1"
                                >
                                  <Checkbox
                                    checked={exclusionState[color.id] ?? color.excludedFromParsing}
                                    onCheckedChange={(checked) =>
                                      handleCheckboxChange(color.id, checked as boolean)
                                    }
                                  />
                                  <span className="text-sm">{color.colorNumber}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

