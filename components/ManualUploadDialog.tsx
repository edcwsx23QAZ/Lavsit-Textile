'use client'

import { useState, useRef } from 'react'
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
import { Upload, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
}

interface ManualUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  type: 'stock' | 'price' | null
  onUpload: () => void
}

export function ManualUploadDialog({
  open,
  onOpenChange,
  supplier,
  type,
  onUpload,
}: ManualUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Проверяем расширение файла
      const ext = selectedFile.name.toLowerCase().split('.').pop()
      if (!['xls', 'xlsx', 'csv'].includes(ext || '')) {
        toast.error('Поддерживаются только файлы Excel (.xls, .xlsx) или CSV')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file || !supplier || !type) {
      toast.error('Выберите файл')
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch(`/api/suppliers/${supplier.id}/manual-upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка загрузки файла')
      }

      const data = await response.json()
      toast.success(
        type === 'stock'
          ? `Наличие успешно загружено. Обработано: ${data.processed || 0} записей`
          : `Прайс-лист успешно загружен. Обновлено цен: ${data.updated || 0}`
      )

      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onOpenChange(false)
      onUpload()
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onOpenChange(false)
    }
  }

  if (!supplier || !type) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'stock' ? 'Ручная загрузка наличия' : 'Ручная загрузка прайс-листа'}
          </DialogTitle>
          <DialogDescription>
            {type === 'stock'
              ? `Загрузите файл с наличием для поставщика "${supplier.name}". Данные будут обновляться из этого файла до тех пор, пока парсер не получит более новые данные.`
              : `Загрузите прайс-лист для поставщика "${supplier.name}". Система автоматически сопоставит цены по коллекции и цвету.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file">Выберите файл (Excel или CSV)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Выбрать файл
              </Button>
              {file && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-xs">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Отмена
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Загрузить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


