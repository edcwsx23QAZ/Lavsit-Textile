import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import Link from 'next/link'
import './globals.css'
import { Package, Tag, Palette, Home, Square } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Lavsit Textile - Парсер тканей',
  description: 'Система парсинга данных наличия и цен тканей от разных поставщиков',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <nav className="border-b bg-background sticky top-0 z-50 backdrop-blur-sm bg-background/95">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold hover:text-primary transition-colors">
                Lavsit Textile
              </Link>
              <div className="flex gap-1">
                <Link
                  href="/"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                >
                  <Home className="h-4 w-4" />
                  Главная
                </Link>
                <Link
                  href="/fabrics"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                >
                  <Square className="h-4 w-4" />
                  Ткани
                </Link>
                <Link
                  href="/suppliers"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                >
                  <Package className="h-4 w-4" />
                  Поставщики
                </Link>
                <Link
                  href="/categories"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                >
                  <Tag className="h-4 w-4" />
                  Категории
                </Link>
                <Link
                  href="/palette"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
                >
                  <Palette className="h-4 w-4" />
                  Палитра
                </Link>
              </div>
            </div>
          </div>
        </nav>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

