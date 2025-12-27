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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail?: string
  subjectFilter?: string
  searchUnreadOnly?: boolean
  searchDays?: number
}

interface EmailSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  currentConfig?: EmailConfig | null
  onSave: () => void
}

export function EmailSettingsDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  currentConfig,
  onSave,
}: EmailSettingsDialogProps) {
  const [config, setConfig] = useState<EmailConfig>({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    user: '',
    password: '',
    fromEmail: '',
    subjectFilter: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig)
    } else {
      // Default Gmail settings
      setConfig({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        user: '',
        password: '',
        fromEmail: '',
        subjectFilter: '',
    searchUnreadOnly: true,
    searchDays: 90,
      })
    }
  }, [currentConfig, open])

  const handleSave = async () => {
    try {
      setSaving(true)

      // Validate required fields
      if (!config.host || !config.user || !config.password) {
        toast.error('Заполните все обязательные поля')
        return
      }

      const response = await fetch(`/api/suppliers/${supplierId}/email-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfig: config }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save email config')
      }

      toast.success('Настройки email сохранены')
      onSave()
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePreset = (preset: 'gmail' | 'yandex' | 'mailru' | 'outlook') => {
    const presets = {
      gmail: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
      },
      yandex: {
        host: 'imap.yandex.ru',
        port: 993,
        secure: true,
      },
      mailru: {
        host: 'imap.mail.ru',
        port: 993,
        secure: true,
      },
      outlook: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
      },
    }

    setConfig({
      ...config,
      ...presets[preset],
    })

    // Показываем предупреждение для Mail.ru
    if (preset === 'mailru') {
      toast.info('Для Mail.ru обязательно используйте пароль приложения! Создайте его в настройках безопасности Mail.ru → Пароли приложений → Почта', {
        duration: 8000,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки Email для {supplierName}</DialogTitle>
          <DialogDescription>
            Настройте параметры подключения к email для автоматической проверки вложений Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Провайдер (быстрая настройка)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePreset('gmail')}
              >
                Gmail
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePreset('yandex')}
              >
                Яндекс
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePreset('mailru')}
              >
                Mail.ru
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePreset('outlook')}
              >
                Outlook
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">
                IMAP сервер <span className="text-red-500">*</span>
              </Label>
              <Input
                id="host"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="imap.gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">
                Порт <span className="text-red-500">*</span>
              </Label>
              <Input
                id="port"
                type="number"
                value={config.port}
                onChange={(e) =>
                  setConfig({ ...config, port: parseInt(e.target.value) || 993 })
                }
                placeholder="993"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secure">Безопасное соединение (SSL/TLS)</Label>
            <Select
              value={config.secure ? 'true' : 'false'}
              onValueChange={(value) =>
                setConfig({ ...config, secure: value === 'true' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Да (SSL/TLS)</SelectItem>
                <SelectItem value="false">Нет</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user">
              Email адрес <span className="text-red-500">*</span>
            </Label>
            <Input
              id="user"
              type="email"
              value={config.user}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
              placeholder="your-email@gmail.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Пароль / App Password <span className="text-red-500">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="Введите пароль или app password"
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Для Gmail используйте App Password. Для Mail.ru обязательно используйте пароль приложения (не обычный пароль).
              </p>
              {config.host === 'imap.mail.ru' && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Mail.ru требует пароль приложения
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      Обычный пароль не работает! Создайте пароль приложения в{' '}
                      <a
                        href="https://id.mail.ru/profile/security"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline font-medium"
                      >
                        настройках безопасности Mail.ru
                      </a>
                      {' '}→ Пароли приложений → Почта
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">
              Email отправителя (фильтр)
            </Label>
            <Input
              id="fromEmail"
              type="email"
              value={config.fromEmail || ''}
              onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
              placeholder="supplier@example.com (опционально)"
            />
            <p className="text-xs text-muted-foreground">
              Оставьте пустым, чтобы проверять все письма
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subjectFilter">
              Фильтр по теме письма
            </Label>
            <Input
              id="subjectFilter"
              value={config.subjectFilter || ''}
              onChange={(e) => setConfig({ ...config, subjectFilter: e.target.value })}
              placeholder="Остатки (опционально)"
            />
            <p className="text-xs text-muted-foreground">
              Оставьте пустым, чтобы проверять все письма
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="searchUnreadOnly">Поиск только непрочитанных</Label>
              <Select
                value={config.searchUnreadOnly !== false ? 'true' : 'false'}
                onValueChange={(value) =>
                  setConfig({ ...config, searchUnreadOnly: value === 'true' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Только непрочитанные</SelectItem>
                  <SelectItem value="false">Все письма</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Если письма уже прочитаны, выберите "Все письма"
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchDays">
                Период поиска (дней)
              </Label>
              <Input
                id="searchDays"
                type="number"
                min="1"
                max="30"
                value={config.searchDays || 90}
                onChange={(e) =>
                  setConfig({ ...config, searchDays: parseInt(e.target.value) || 90 })
                }
                placeholder="90"
              />
              <p className="text-xs text-muted-foreground">
                За сколько дней назад искать письма (по умолчанию: 90)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

