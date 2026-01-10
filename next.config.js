/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Отключаем static optimization для всех страниц, которые используют базу данных
  experimental: {
    // Это поможет избежать проблем с static generation
  },
}

module.exports = nextConfig

