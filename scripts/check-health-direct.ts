/**
 * Прямая проверка health endpoint
 */

import https from 'https'

const VERCEL_URL = 'https://lavsit-textile.vercel.app'

https.get(`${VERCEL_URL}/api/health`, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    try {
      const health = JSON.parse(data)
      console.log(JSON.stringify(health, null, 2))
    } catch (error) {
      console.error('Ошибка парсинга:', error)
      console.log('Raw response:', data)
    }
  })
}).on('error', (error) => {
  console.error('Ошибка запроса:', error)
})

