'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface LoadingProgressProps {
  progress: number // 0-100
  stage: string
  current?: number
  total?: number
}

export default function LoadingProgress({ progress, stage, current, total }: LoadingProgressProps) {
  const progressPercent = Math.max(0, Math.min(100, Math.round(progress)))
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Загрузка данных</h3>
              <p className="text-sm text-muted-foreground">{stage}</p>
            </div>
            
            <div className="space-y-3">
              {/* Процент загрузки - крупный и заметный */}
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-1">
                  {progressPercent}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Выполнено
                </div>
              </div>
              
              {/* Прогресс-бар */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Прогресс загрузки</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                
                <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="h-full w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80" />
                  </div>
                </div>
              </div>
              
              {/* Дополнительная информация */}
              {current !== undefined && total !== undefined && total > 0 && (
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium">
                    Загружено {current.toLocaleString('ru')} из {total.toLocaleString('ru')} тканей
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {total > 0 ? Math.round((current / total) * 100) : 0}% записей
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-xs text-center text-muted-foreground pt-2 border-t">
              Первая загрузка может занять некоторое время. Данные будут сохранены для быстрого доступа.
            </div>
          </div>
        </CardContent>
      </Card>
      
    </div>
  )
}

