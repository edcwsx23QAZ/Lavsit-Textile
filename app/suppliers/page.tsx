'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { RefreshCw, AlertCircle, Download, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { ParsingRulesDialog } from '@/components/ParsingRulesDialog'
import { EmailSettingsDialog } from '@/components/EmailSettingsDialog'
import { ManualUploadDialog } from '@/components/ManualUploadDialog'
import { useState } from 'react'

interface Supplier {
  id: string
  name: string
  websiteUrl: string
  parsingMethod: string
  parsingUrl: string
  emailConfig?: string | null
  fabricsCount: number
  lastUpdatedAt: Date | null
  status: string
  errorMessage: string | null
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [parsingSupplier, setParsingSupplier] = useState<string | null>(null)
  const [parsingAll, setParsingAll] = useState(false)
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false)
  const [analyzingSupplier, setAnalyzingSupplier] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [checkingEmail, setCheckingEmail] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadType, setUploadType] = useState<'stock' | 'price' | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/suppliers')
      if (!response.ok) throw new Error('Failed to fetch suppliers')
      const data = await response.json()
      setSuppliers(data)
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const handleAnalyze = async (supplierId: string) => {
    try {
      setAnalyzingSupplier(supplierId)
      const response = await fetch(`/api/suppliers/${supplierId}/analyze`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to analyze')
      }
      const data = await response.json()
      setAnalysisData({ ...data, supplierId })
      setRulesDialogOpen(true)
    } catch (error: any) {
      toast.error('Ошибка анализа: ' + error.message)
    } finally {
      setAnalyzingSupplier(null)
    }
  }

  const handleSaveRules = async (rules: any) => {
    if (!analysisData) return
    
    try {
      const response = await fetch(`/api/suppliers/${analysisData.supplierId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      })
      if (!response.ok) throw new Error('Failed to save rules')
      
      // После сохранения правил сразу запускаем парсинг
      await handleParse(analysisData.supplierId)
    } catch (error: any) {
      throw error
    }
  }

  const handleParse = async (supplierId: string) => {
    try {
      setParsingSupplier(supplierId)
      const response = await fetch(`/api/suppliers/${supplierId}/parse`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to parse')
      }
      const data = await response.json()
      toast.success(`Обновлено: ${data.fabricsCount} тканей`)
      fetchSuppliers()
    } catch (error: any) {
      // Если ошибка о том, что правила не установлены, предлагаем анализ
      if (error.message.includes('правила парсинга не установлены')) {
        toast.info('Сначала нужно настроить правила парсинга')
        await handleAnalyze(supplierId)
      } else {
        toast.error('Ошибка парсинга: ' + error.message)
      }
    } finally {
      setParsingSupplier(null)
    }
  }

  const handleParseAll = async () => {
    try {
      setParsingAll(true)
      const response = await fetch('/api/suppliers/parse-all', {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to parse all')
      }
      const data = await response.json()
      toast.success(
        `Обновлено: ${data.successCount} из ${data.total} поставщиков`
      )
      fetchSuppliers()
    } catch (error: any) {
      toast.error('Ошибка обновления: ' + error.message)
    } finally {
      setParsingAll(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Поставщики</CardTitle>
            <Button
              onClick={handleParseAll}
              disabled={parsingAll}
              variant="outline"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${parsingAll ? 'animate-spin' : ''}`}
              />
              Обновить все данные
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Поставщики не найдены
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Название</TableHead>
                    <TableHead className="w-[150px]">Адрес сайта</TableHead>
                    <TableHead className="w-[100px]">Метод</TableHead>
                    <TableHead className="w-[200px]">Ссылка на ресурс</TableHead>
                    <TableHead className="w-[80px]">Ткани</TableHead>
                    <TableHead className="w-[110px]">Обновлено</TableHead>
                    <TableHead className="w-[90px]">Статус</TableHead>
                    <TableHead className="w-[280px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium truncate" title={supplier.name}>
                        {supplier.name}
                      </TableCell>
                      <TableCell>
                        <a
                          href={supplier.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate block"
                          title={supplier.websiteUrl}
                        >
                          {supplier.websiteUrl}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {supplier.parsingMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {supplier.parsingUrl ? (
                          <a
                            href={supplier.parsingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs truncate block"
                            title={supplier.parsingUrl}
                          >
                            {supplier.parsingUrl.length > 30 
                              ? supplier.parsingUrl.substring(0, 30) + '...'
                              : supplier.parsingUrl}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{supplier.fabricsCount}</TableCell>
                      <TableCell className="text-xs">
                        {supplier.lastUpdatedAt
                          ? formatDate(supplier.lastUpdatedAt)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {supplier.status === 'active' ? (
                          <Badge variant="success">Активен</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">Ошибка</Badge>
                            {supplier.errorMessage && (
                              <span
                                className="text-xs text-muted-foreground"
                                title={supplier.errorMessage}
                              >
                                <AlertCircle className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAnalyze(supplier.id)}
                            disabled={
                              analyzingSupplier === supplier.id ||
                              parsingSupplier === supplier.id ||
                              parsingAll
                            }
                            className="text-xs px-2 h-7"
                            title="Анализ структуры данных"
                          >
                            {analyzingSupplier === supplier.id ? '...' : 'Анализ'}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleParse(supplier.id)}
                            disabled={
                              parsingSupplier === supplier.id || parsingAll
                            }
                            className="text-xs px-2 h-7"
                            title="Обновить данные"
                          >
                            {parsingSupplier === supplier.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          {supplier.parsingMethod === 'email' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSupplier(supplier)
                                setEmailSettingsOpen(true)
                              }}
                              className="text-xs px-2 h-7"
                              title="Настройки Email"
                            >
                              Email
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setUploadType('stock')
                              setUploadDialogOpen(true)
                            }}
                            className="text-xs px-2 h-7"
                            title="Ручная загрузка наличия"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Наличие
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setUploadType('price')
                              setUploadDialogOpen(true)
                            }}
                            className="text-xs px-2 h-7"
                            title="Ручная загрузка прайс-листа"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Прайс
                          </Button>
                          {supplier.parsingMethod === 'email' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSupplier(supplier)
                                setEmailSettingsOpen(true)
                              }}
                              className="text-xs px-2 h-7"
                              title="Настройки Email"
                            >
                              Email
                            </Button>
                          )}
                          {supplier.parsingMethod === 'email' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  setCheckingEmail(supplier.id)
                                  const response = await fetch(`/api/suppliers/${supplier.id}/parse-email`, {
                                    method: 'POST',
                                  })
                                  
                                  // Check content type before parsing
                                  const contentType = response.headers.get('content-type')
                                  const isJson = contentType && contentType.includes('application/json')
                                  
                                  if (!response.ok) {
                                    let errorMessage = 'Failed to check email'
                                    if (isJson) {
                                      try {
                                        const error = await response.json()
                                        errorMessage = error.error || errorMessage
                                      } catch (e) {
                                        // If JSON parsing fails, try to get text
                                        const text = await response.text()
                                        errorMessage = text || errorMessage
                                      }
                                    } else {
                                      // If not JSON, try to extract error from HTML or use status text
                                      const text = await response.text()
                                      // Try to find error message in HTML
                                      const match = text.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                                                   text.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                                                   text.match(/error[^>]*>([^<]+)/i)
                                      errorMessage = match ? match[1] : response.statusText || errorMessage
                                    }
                                    throw new Error(errorMessage)
                                  }
                                  
                                  if (!isJson) {
                                    const text = await response.text()
                                    throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
                                  }
                                  
                                  const data = await response.json()
                                  if (data.emailsChecked === 0 && data.message) {
                                    toast.warning(
                                      `${data.message} Проверено писем: ${data.emailsChecked}`
                                    )
                                  } else {
                                    toast.success(
                                      `Проверено писем: ${data.emailsChecked}, обработано вложений: ${data.attachmentsProcessed}, найдено тканей: ${data.fabricsCount}`
                                    )
                                  }
                                  fetchSuppliers()
                                } catch (error: any) {
                                  console.error('Email check error:', error)
                                  toast.error('Ошибка проверки email: ' + (error.message || 'Unknown error'))
                                } finally {
                                  setCheckingEmail(null)
                                }
                              }}
                              disabled={checkingEmail === supplier.id}
                              className="text-xs px-2 h-7"
                              title="Проверить Email"
                            >
                              {checkingEmail === supplier.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                '📧'
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/suppliers/${supplier.id}/export`)
                                if (!response.ok) throw new Error('Failed to download')
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `${supplier.name}-${new Date().toISOString().split('T')[0]}.xlsx`
                                document.body.appendChild(a)
                                a.click()
                                window.URL.revokeObjectURL(url)
                                document.body.removeChild(a)
                                toast.success('Файл успешно скачан')
                              } catch (error: any) {
                                toast.error('Ошибка скачивания: ' + error.message)
                              }
                            }}
                            className="text-xs px-2 h-7"
                            title="Скачать данные"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {analysisData && (
        <ParsingRulesDialog
          open={rulesDialogOpen}
          onOpenChange={setRulesDialogOpen}
          supplierId={analysisData.supplierId}
          supplierName={
            suppliers.find((s) => s.id === analysisData.supplierId)?.name || ''
          }
          questions={analysisData.questions}
          sampleData={analysisData.sampleData}
          onSave={handleSaveRules}
        />
      )}

      {selectedSupplier && (
        <EmailSettingsDialog
          open={emailSettingsOpen}
          onOpenChange={setEmailSettingsOpen}
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          currentConfig={
            selectedSupplier.emailConfig
              ? JSON.parse(selectedSupplier.emailConfig)
              : null
          }
          onSave={fetchSuppliers}
        />
      )}
      {selectedSupplier && (
        <ManualUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          supplier={selectedSupplier}
          type={uploadType}
          onUpload={fetchSuppliers}
        />
      )}
    </div>
  )
}

