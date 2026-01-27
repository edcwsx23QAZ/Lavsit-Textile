/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Показываем детальные ошибки в production для диагностики
  onDemandEntries: {
    // Увеличиваем время хранения страниц в памяти
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Отключаем static optimization для всех страниц, которые используют базу данных
  experimental: {
    // Это поможет избежать проблем с static generation
  },
  // Включаем детальное логирование ошибок
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

module.exports = nextConfig

