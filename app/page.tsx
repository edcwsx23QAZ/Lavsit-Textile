'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export default function Home() {
  const handleDownloadAll = async () => {
    try {
      const response = await fetch('/api/fabrics/export')
      if (!response.ok) throw new Error('Failed to download')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `all-fabrics-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Файл успешно скачан')
    } catch (error: any) {
      toast.error('Ошибка скачивания: ' + error.message)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-8">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-4xl font-bold mb-4">
          Lavsit Textile
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Парсер данных наличия и цен тканей от разных поставщиков
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/fabrics">
            <Button size="lg">Сводная таблица тканей</Button>
          </Link>
          <Link href="/suppliers">
            <Button size="lg" variant="outline">Поставщики</Button>
          </Link>
          <Button size="lg" variant="secondary" onClick={handleDownloadAll}>
            <Download className="mr-2 h-4 w-4" />
            Скачать список тканей
          </Button>
        </div>
      </div>
    </main>
  )
}

