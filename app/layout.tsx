import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import Link from 'next/link'
import './globals.css'

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
        <nav className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold">
                Lavsit Textile
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/fabrics"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Ткани
                </Link>
                <Link
                  href="/suppliers"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Поставщики
                </Link>
                <Link
                  href="/categories"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Категории тканей
                </Link>
                <Link
                  href="/palette"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Палитра цветов
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

