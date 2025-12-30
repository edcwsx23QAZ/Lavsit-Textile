'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Tag, Palette, Square } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Lavsit Textile</h1>
        <p className="text-muted-foreground text-lg">
          Система парсинга данных наличия и цен тканей от разных поставщиков
        </p>
      </div>

      {/* Быстрые ссылки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/fabrics">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Square className="h-5 w-5" />
                Ткани
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Просмотр и управление всеми тканями
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/suppliers">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Поставщики
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Управление поставщиками и парсингом
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/categories">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Категории
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Настройка категорий цен
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/palette">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Палитра
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Визуальная палитра цветов тканей
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
