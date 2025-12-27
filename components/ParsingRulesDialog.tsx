'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Question {
  id: string
  question: string
  type: 'column' | 'row' | 'header' | 'skip'
  options?: string[]
  default?: string
}

interface ParsingRulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  questions: Question[]
  sampleData: any[]
  onSave: (rules: any) => Promise<void>
}

export function ParsingRulesDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  questions,
  sampleData,
  onSave,
}: ParsingRulesDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Инициализируем ответы значениями по умолчанию
    const initialAnswers: Record<string, string> = {}
    questions.forEach((q) => {
      if (q.default) {
        initialAnswers[q.id] = q.default
      }
    })
    setAnswers(initialAnswers)
  }, [questions])

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Преобразуем ответы в правила парсинга
      const rules: any = {
        columnMappings: {},
        skipRows: [],
        skipPatterns: [],
      }

      questions.forEach((question) => {
        const answer = answers[question.id]
        if (!answer) return

        if (question.type === 'column') {
          // Извлекаем номер колонки из ответа (например, "Колонка 2 (B)" -> 2)
          const match = answer.match(/Колонка (\d+)/)
          if (match) {
            const columnIndex = parseInt(match[1]) - 1 // Преобразуем в 0-based индекс

            if (question.id === 'collection-column') {
              rules.columnMappings.collection = columnIndex
            } else if (question.id === 'stock-column') {
              rules.columnMappings.inStock = columnIndex
            } else if (question.id === 'meterage-column') {
              rules.columnMappings.meterage = columnIndex
            } else if (question.id === 'arrival-column') {
              rules.columnMappings.nextArrivalDate = columnIndex
            } else if (question.id === 'comment-column') {
              rules.columnMappings.comment = columnIndex
            }
          }
        } else if (question.type === 'row') {
          // Обработка строк для пропуска
          if (answer.includes('Строка')) {
            const match = answer.match(/Строка (\d+)/)
            if (match) {
              rules.skipRows.push(parseInt(match[1]))
            }
          }
        } else if (question.type === 'header') {
          if (answer === 'Да') {
            rules.headerRow = 1
            rules.skipRows.push(1)
          }
        }
      })

      // Специальные правила
      if (supplierName === 'Домиарт') {
        rules.specialRules = {
          alfa2303Pattern: true,
        }
      }

      await onSave(rules)
      toast.success('Правила парсинга сохранены')
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройка правил парсинга: {supplierName}</DialogTitle>
          <DialogDescription>
            Пожалуйста, ответьте на вопросы для настройки парсера
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label>{question.question}</Label>
              {question.type === 'column' && question.options && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={
                        answers[question.id] === option
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => handleAnswer(question.id, option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
              {question.type === 'row' && question.options && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={
                        answers[question.id]?.includes(option)
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => {
                        const current = answers[question.id] || ''
                        const newValue = current.includes(option)
                          ? current.replace(option, '').trim()
                          : current
                            ? `${current} ${option}`.trim()
                            : option
                        handleAnswer(question.id, newValue)
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
              {(question.type === 'header' || question.type === 'skip') &&
                question.options && (
                  <div className="flex gap-2">
                    {question.options.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={
                          answers[question.id] === option
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => handleAnswer(question.id, option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
            </div>
          ))}

          {sampleData.length > 0 && (
            <div className="mt-6">
              <Label className="mb-2 block">Пример данных:</Label>
              <div className="border rounded-md p-4 overflow-x-auto">
                <table className="text-xs">
                  <tbody>
                    {sampleData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell: any, j: number) => (
                          <td key={j} className="px-2 py-1 border">
                            {String(cell || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить правила'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


