'use client'

import React, { useState } from 'react'
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
import { ExternalLink, Settings, RefreshCw, Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  websiteUrl: string
  parsingMethod: string
  parsingUrl: string
  emailConfig: string | null
  lastUpdatedAt: Date | null
  status: string
  errorMessage: string | null
  fabricsCount: number
}

interface SuppliersPageClientProps {
  suppliers: Supplier[]
}

export function SuppliersPageClient({ suppliers }: SuppliersPageClientProps) {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [emailConfig, setEmailConfig] = useState<any>(null)
  const [uploadDialog, setUploadDialog] = useState<{ supplier: Supplier; type: 'stock' | 'pricelist' } | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parsingSupplierId, setParsingSupplierId] = useState<string | null>(null)
  const [parsingAll, setParsingAll] = useState(false)
  const [clearingSupplierId, setClearingSupplierId] = useState<string | null>(null)
  const [clearConfirmDialog, setClearConfirmDialog] = useState<{ supplier: Supplier } | null>(null)

  const handleEdit = async (supplier: Supplier) => {
    setEditingSupplier(supplier)
    // Парсим emailConfig если есть
    if (supplier.emailConfig) {
      try {
        const parsed = JSON.parse(supplier.emailConfig)
        // Конвертируем из плоской структуры (для EmailParser) в вложенную (для UI)
        if (parsed.host || parsed.port || parsed.user || parsed.password !== undefined) {
          // Плоская структура (старая или от EmailParser)
          setEmailConfig({
            imap: {
              host: parsed.host || '',
              port: parsed.port || 993,
              user: parsed.user || '',
              password: parsed.password || '',
              secure: parsed.secure !== false,
            },
            fromEmail: parsed.fromEmail || '',
            subjectFilter: parsed.subjectFilter || '',
            searchDays: parsed.searchDays || 90,
            searchUnreadOnly: parsed.searchUnreadOnly !== undefined ? parsed.searchUnreadOnly : false,
            useAnyLatestAttachment: parsed.useAnyLatestAttachment || false,
          })
        } else {
          // Вложенная структура (текущая UI структура)
          setEmailConfig(parsed)
        }
      } catch {
        setEmailConfig(null)
      }
    } else {
      setEmailConfig(null)
    }
  }

  const handleSave = async () => {
    if (!editingSupplier) return

    try {
      // Конвертируем из вложенной структуры (UI) в плоскую (для EmailParser)
      let emailConfigToSave = emailConfig
      if (emailConfig && editingSupplier.parsingMethod === 'email' && emailConfig.imap) {
        emailConfigToSave = {
          host: emailConfig.imap.host || '',
          port: emailConfig.imap.port || 993,
          user: emailConfig.imap.user || '',
          password: emailConfig.imap.password || '',
          secure: emailConfig.imap.secure !== false,
          fromEmail: emailConfig.fromEmail || '',
          subjectFilter: emailConfig.subjectFilter || '',
          searchDays: emailConfig.searchDays || 90,
          searchUnreadOnly: emailConfig.searchUnreadOnly !== undefined ? emailConfig.searchUnreadOnly : false,
          useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true, // Явно проверяем на true
        }
        console.log('[SuppliersPageClient] Saving email config:', JSON.stringify(emailConfigToSave, null, 2))
      }

      const response = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsingMethod: editingSupplier.parsingMethod,
          parsingUrl: editingSupplier.parsingUrl,
          websiteUrl: editingSupplier.websiteUrl,
          emailConfig: emailConfigToSave ? JSON.stringify(emailConfigToSave) : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success('Настройки поставщика обновлены')
      setEditingSupplier(null)
      // Перезагружаем страницу для обновления данных
      window.location.reload()
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    }
  }

  const handleUploadStock = (supplier: Supplier) => {
    setUploadDialog({ supplier, type: 'stock' })
    setUploadFile(null)
  }

  const handleUploadPriceList = (supplier: Supplier) => {
    setUploadDialog({ supplier, type: 'pricelist' })
    setUploadFile(null)
  }

  const handleFileUpload = async () => {
    if (!uploadDialog || !uploadFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const endpoint = uploadDialog.type === 'stock'
        ? `/api/suppliers/${uploadDialog.supplier.id}/upload-stock`
        : `/api/suppliers/${uploadDialog.supplier.id}/upload-pricelist`

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        // Сначала получаем текст ответа
        const responseText = await response.text()
        let errorMessage = 'Ошибка загрузки файла'
        
        // Пытаемся распарсить JSON, если это возможно
        if (responseText) {
          try {
            const error = JSON.parse(responseText)
            errorMessage = error.error || error.message || errorMessage
          } catch {
            // Если не JSON, используем текст ответа как сообщение об ошибке
            errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`
          }
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      // Для успешного ответа также безопасно парсим JSON
      const responseText = await response.text()
      let result
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      toast.success(uploadDialog.type === 'stock' ? 'Наличие успешно загружено' : 'Прайс-лист успешно загружен')
      setUploadDialog(null)
      setUploadFile(null)
      // Перезагружаем страницу для обновления данных
      window.location.reload()
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleParseSupplier = async (supplierId: string) => {
    setParsingSupplierId(supplierId)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/parse`, {
        method: 'POST',
      })

      if (!response.ok) {
        // Сначала получаем текст ответа
        const responseText = await response.text()
        let errorMessage = 'Ошибка парсинга'
        
        // Пытаемся распарсить JSON, если это возможно
        if (responseText) {
          try {
            const error = JSON.parse(responseText)
            errorMessage = error.error || error.message || errorMessage
          } catch {
            // Если не JSON, используем текст ответа как сообщение об ошибке
            errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`
          }
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      // Для успешного ответа также безопасно парсим JSON
      const responseText = await response.text()
      let result
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      toast.success(result.message || 'Парсинг завершен')
      // Перезагружаем страницу для обновления данных
      setTimeout(() => window.location.reload(), 1000)
    } catch (error: any) {
      toast.error('Ошибка парсинга: ' + error.message)
    } finally {
      setParsingSupplierId(null)
    }
  }

  const handleParseAll = async () => {
    setParsingAll(true)
    try {
      const response = await fetch('/api/suppliers/parse-all', {
        method: 'POST',
      })

      if (!response.ok) {
        // Сначала получаем текст ответа
        const responseText = await response.text()
        let errorMessage = 'Ошибка парсинга'
        
        // Пытаемся распарсить JSON, если это возможно
        if (responseText) {
          try {
            const error = JSON.parse(responseText)
            errorMessage = error.error || error.message || errorMessage
          } catch {
            // Если не JSON, используем текст ответа как сообщение об ошибке
            errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`
          }
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      // Для успешного ответа также безопасно парсим JSON
      const responseText = await response.text()
      let result
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      toast.success(result.message || 'Парсинг всех поставщиков запущен')
      // Перезагружаем страницу для обновления данных
      setTimeout(() => window.location.reload(), 2000)
    } catch (error: any) {
      toast.error('Ошибка парсинга: ' + error.message)
      setParsingAll(false)
    }
  }

  const handleClearFabrics = async (supplier: Supplier) => {
    setClearingSupplierId(supplier.id)
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/fabrics`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Сначала получаем текст ответа
        const responseText = await response.text()
        let errorMessage = 'Ошибка удаления данных'
        
        // Пытаемся распарсить JSON, если это возможно
        if (responseText) {
          try {
            const error = JSON.parse(responseText)
            errorMessage = error.error || error.message || errorMessage
          } catch {
            // Если не JSON, используем текст ответа как сообщение об ошибке
            errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`
          }
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      // Для успешного ответа также безопасно парсим JSON
      const responseText = await response.text()
      let result
      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      toast.success(result.message || `Данные поставщика "${supplier.name}" успешно очищены`)
      setClearConfirmDialog(null)
      // Перезагружаем страницу для обновления данных
      setTimeout(() => window.location.reload(), 1000)
    } catch (error: any) {
      toast.error('Ошибка удаления: ' + error.message)
    } finally {
      setClearingSupplierId(null)
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button 
          onClick={handleParseAll} 
          disabled={parsingAll}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${parsingAll ? 'animate-spin' : ''}`} />
          Обновить все
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Поставщик</TableHead>
              <TableHead>Метод парсинга</TableHead>
              <TableHead>URL/Email</TableHead>
              <TableHead className="text-right">Тканей</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead className="text-center">Обновлено</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{supplier.parsingMethod}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {supplier.parsingUrl || supplier.emailConfig ? (
                    <a
                      href={supplier.parsingUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => !supplier.parsingUrl && e.preventDefault()}
                    >
                      {supplier.parsingUrl || 'Email парсинг'}
                    </a>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {supplier.fabricsCount.toLocaleString('ru')}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={supplier.status === 'active' ? 'default' : 'destructive'}>
                    {supplier.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {supplier.lastUpdatedAt
                    ? new Date(supplier.lastUpdatedAt).toLocaleDateString('ru')
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-center">
                    {supplier.websiteUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={supplier.websiteUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleParseSupplier(supplier.id)}
                      disabled={parsingSupplierId === supplier.id || parsingAll}
                      title="Обновить данные поставщика"
                    >
                      <RefreshCw className={`h-4 w-4 ${parsingSupplierId === supplier.id ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUploadStock(supplier)}
                      title="Загрузить наличие (Excel)"
                    >
                      📊
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUploadPriceList(supplier)}
                      title="Загрузить прайс-лист (Excel)"
                    >
                      💰
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setClearConfirmDialog({ supplier })}
                      disabled={clearingSupplierId === supplier.id || supplier.fabricsCount === 0}
                      title="Очистить все данные поставщика"
                    >
                      <Trash2 className={`h-4 w-4 ${clearingSupplierId === supplier.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(supplier)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Диалог настроек */}
      {editingSupplier && (
        <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Настройки поставщика: {editingSupplier.name}</DialogTitle>
              <DialogDescription>
                Настройте параметры парсинга для этого поставщика
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Тип парсера */}
              <div>
                <Label htmlFor="parsingMethod">Тип парсера</Label>
                <Select
                  value={editingSupplier.parsingMethod}
                  onValueChange={(value) => setEditingSupplier({ ...editingSupplier, parsingMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML парсинг</SelectItem>
                    <SelectItem value="excel">Excel по URL</SelectItem>
                    <SelectItem value="email">Email парсинг</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* URL для HTML/Excel парсинга */}
              {(editingSupplier.parsingMethod === 'html' || editingSupplier.parsingMethod === 'excel') && (
                <div>
                  <Label htmlFor="parsingUrl">URL для парсинга</Label>
                  <Input
                    id="parsingUrl"
                    value={editingSupplier.parsingUrl || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, parsingUrl: e.target.value })}
                    placeholder="https://example.com/data"
                  />
                </div>
              )}

              {/* Настройки Email парсинга */}
              {editingSupplier.parsingMethod === 'email' && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold">Настройки Email (IMAP)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="imapHost">IMAP Host</Label>
                      <Input
                        id="imapHost"
                        value={emailConfig?.imap?.host || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          imap: { ...emailConfig?.imap, host: e.target.value }
                        })}
                        placeholder="imap.gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imapPort">IMAP Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        value={emailConfig?.imap?.port || 993}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          imap: { ...emailConfig?.imap, port: parseInt(e.target.value) || 993 }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="imapUser">Email (User)</Label>
                      <Input
                        id="imapUser"
                        type="email"
                        value={emailConfig?.imap?.user || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          imap: { ...emailConfig?.imap, user: e.target.value }
                        })}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imapPassword">App Password</Label>
                      <Input
                        id="imapPassword"
                        type="password"
                        value={emailConfig?.imap?.password || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          imap: { ...emailConfig?.imap, password: e.target.value }
                        })}
                        placeholder="App Password"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="imapSecure">Secure (TLS)</Label>
                    <Select
                      value={emailConfig?.imap?.secure ? 'true' : 'false'}
                      onValueChange={(value) => setEmailConfig({
                        ...emailConfig,
                        imap: { ...emailConfig?.imap, secure: value === 'true' }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Да (TLS)</SelectItem>
                        <SelectItem value="false">Нет</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fromEmail">Отправитель (From Email)</Label>
                    <Input
                      id="fromEmail"
                      type="email"
                      value={emailConfig?.fromEmail || ''}
                      onChange={(e) => setEmailConfig({
                        ...emailConfig,
                        fromEmail: e.target.value
                      })}
                      placeholder="sender@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="subjectFilter">Фильтр по теме письма</Label>
                    <Input
                      id="subjectFilter"
                      value={emailConfig?.subjectFilter || ''}
                      onChange={(e) => setEmailConfig({
                        ...emailConfig,
                        subjectFilter: e.target.value
                      })}
                      placeholder="Остатки тканей"
                    />
                  </div>

                  <div>
                    <Label htmlFor="searchDays">Период поиска (дней)</Label>
                    <Input
                      id="searchDays"
                      type="number"
                      value={emailConfig?.searchDays || 90}
                      onChange={(e) => setEmailConfig({
                        ...emailConfig,
                        searchDays: parseInt(e.target.value) || 90
                      })}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="searchUnreadOnly"
                      checked={emailConfig?.searchUnreadOnly === false || emailConfig?.searchUnreadOnly === undefined}
                      onCheckedChange={(checked) => setEmailConfig({
                        ...emailConfig,
                        searchUnreadOnly: !checked // Инвертируем: если checked = true (чекбокс включен), то searchUnreadOnly = false (ищем все письма)
                      })}
                    />
                    <Label htmlFor="searchUnreadOnly" className="text-sm font-normal cursor-pointer">
                      Проверять в том числе прочитанные письма (если выключено, ищутся только непрочитанные)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="useAnyLatestAttachment"
                      checked={emailConfig?.useAnyLatestAttachment || false}
                      onCheckedChange={(checked) => setEmailConfig({
                        ...emailConfig,
                        useAnyLatestAttachment: checked
                      })}
                    />
                    <Label htmlFor="useAnyLatestAttachment" className="text-sm font-normal cursor-pointer">
                      Использовать любое последнее вложение (включая обработанные)
                    </Label>
                  </div>
                </div>
              )}

              {/* Настройки соответствия столбцов (для Excel парсинга) */}
              {editingSupplier.parsingMethod === 'excel' && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold">Соответствие столбцов</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="collectionColumn">Столбец коллекции</Label>
                      <Input
                        id="collectionColumn"
                        type="number"
                        value={emailConfig?.rules?.collectionColumn || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          rules: { ...emailConfig?.rules, collectionColumn: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="colorColumn">Столбец цвета</Label>
                      <Input
                        id="colorColumn"
                        type="number"
                        value={emailConfig?.rules?.colorColumn || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          rules: { ...emailConfig?.rules, colorColumn: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="meterageColumn">Столбец метража</Label>
                      <Input
                        id="meterageColumn"
                        type="number"
                        value={emailConfig?.rules?.meterageColumn || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          rules: { ...emailConfig?.rules, meterageColumn: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="priceColumn">Столбец цены</Label>
                      <Input
                        id="priceColumn"
                        type="number"
                        value={emailConfig?.rules?.priceColumn || ''}
                        onChange={(e) => setEmailConfig({
                          ...emailConfig,
                          rules: { ...emailConfig?.rules, priceColumn: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="3"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="headerRow">Строка заголовка</Label>
                    <Input
                      id="headerRow"
                      type="number"
                      value={emailConfig?.rules?.headerRow || 0}
                      onChange={(e) => setEmailConfig({
                        ...emailConfig,
                        rules: { ...emailConfig?.rules, headerRow: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSupplier(null)}>
                Отмена
              </Button>
              <Button onClick={handleSave}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог загрузки файла */}
      {uploadDialog && (
        <Dialog open={!!uploadDialog} onOpenChange={() => setUploadDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {uploadDialog.type === 'stock' ? 'Загрузка наличия' : 'Загрузка прайс-листа'} - {uploadDialog.supplier.name}
              </DialogTitle>
              <DialogDescription>
                {uploadDialog.type === 'stock'
                  ? 'Загрузите Excel файл с наличием тканей (коллекция, цвет, метраж)'
                  : 'Загрузите Excel файл с прайс-листом. Система автоматически определит тип прайс-листа (цена на цвет или цена на коллекцию).'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="file">Выберите файл (Excel)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialog(null)} disabled={uploading}>
                Отмена
              </Button>
              <Button onClick={handleFileUpload} disabled={!uploadFile || uploading}>
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Диалог подтверждения очистки данных */}
      {clearConfirmDialog && (
        <Dialog open={!!clearConfirmDialog} onOpenChange={() => setClearConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Очистить все данные поставщика</DialogTitle>
              <DialogDescription>
                Вы уверены, что хотите удалить все ткани и цвета поставщика "{clearConfirmDialog.supplier.name}"?
                <br />
                <br />
                <strong>Будет удалено: {clearConfirmDialog.supplier.fabricsCount.toLocaleString('ru')} тканей</strong>
                <br />
                <br />
                Это действие нельзя отменить. Все данные последнего парсера будут удалены.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setClearConfirmDialog(null)}
                disabled={clearingSupplierId === clearConfirmDialog.supplier.id}
              >
                Отмена
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleClearFabrics(clearConfirmDialog.supplier)}
                disabled={clearingSupplierId === clearConfirmDialog.supplier.id}
              >
                {clearingSupplierId === clearConfirmDialog.supplier.id ? 'Удаление...' : 'Удалить все данные'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
