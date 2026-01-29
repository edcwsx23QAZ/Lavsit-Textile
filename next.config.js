/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Показываем детальные ошибки в production для диагностики
  onDemandEntries: {
    // Увеличиваем время хранения страниц в памяти
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  
  // Включаем детальное логирование ошибок
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Настройки для лучшей обработки ошибок в production
  // Отключаем минификацию ошибок для лучшей диагностики
  productionBrowserSourceMaps: false,
  
  // Улучшаем обработку ошибок при сборке
  typescript: {
    // Не останавливаем сборку при ошибках типов (если они есть)
    ignoreBuildErrors: false,
  },
  
  eslint: {
    // Не останавливаем сборку при ошибках ESLint
    ignoreDuringBuilds: false,
  },
  
  // Настройки для Server Components
  experimental: {
    // Это поможет избежать проблем с static generation
  },
  
  // Улучшаем обработку ошибок в runtime
  onDemandRevalidation: {
    // Время жизни кеша для revalidation
    maxAge: 60,
  },
}

module.exports = nextConfig

