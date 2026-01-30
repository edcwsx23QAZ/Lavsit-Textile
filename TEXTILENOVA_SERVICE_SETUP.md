# Настройка TextileNova Parser Service

## Что было сделано

1. ✅ Создан отдельный сервис для парсера TextileNova в директории `textilenova-parser-service`
2. ✅ Сервис использует Express и может быть задеплоен на Render/Railway
3. ✅ Обновлен парсер в Vercel приложении для вызова внешнего сервиса
4. ✅ Добавлена обработка ошибок и логирование

## Следующие шаги

### 1. Деплой сервиса на Render

1. Зайдите на [render.com](https://render.com)
2. Создайте новый Web Service
3. Подключите GitHub репозиторий
4. Настройки:
   - **Root Directory**: `textilenova-parser-service`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. После деплоя скопируйте URL сервиса (например: `https://textilenova-parser-service.onrender.com`)

### 2. Настройка переменной окружения в Vercel

1. Зайдите в Vercel Dashboard → Ваш проект → Settings → Environment Variables
2. Добавьте переменную:
   - **Key**: `TEXTILENOVA_PARSER_SERVICE_URL`
   - **Value**: URL вашего Render сервиса
   - **Environment**: Production, Preview, Development (все)
3. Сохраните и передеплойте приложение

### 3. Проверка работы

После деплоя проверьте:

1. Health check сервиса:
   ```
   GET https://your-service-url.onrender.com/health
   ```

2. Тест через Vercel приложение:
   - Зайдите в приложение
   - Попробуйте проанализировать TextileNova поставщика
   - Проверьте логи в Vercel Dashboard

## Структура сервиса

```
textilenova-parser-service/
├── src/
│   ├── parser.ts      # Логика парсера
│   └── server.ts      # Express сервер
├── package.json
├── tsconfig.json
├── render.yaml        # Конфигурация для Render
└── DEPLOY.md          # Подробная инструкция по деплою
```

## API Endpoints

### POST /parse
Парсит данные с URL используя правила.

**Request:**
```json
{
  "url": "https://textilnova.ru/...",
  "rules": {
    "skipRows": [1],
    "skipPatterns": ["заголовок"],
    "specialRules": {}
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 123
}
```

### POST /analyze
Анализирует структуру данных.

**Request:**
```json
{
  "url": "https://textilnova.ru/..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "questions": [...],
    "sampleData": [...],
    "structure": {...}
  }
}
```

### GET /health
Health check endpoint.

## Логирование

Все логи выводятся в консоль и доступны:
- **Render**: Dashboard → Logs
- **Railway**: Dashboard → Deployments → View Logs
- **Vercel**: Dashboard → Functions → Logs

## Troubleshooting

### Проблема: Внешний сервис недоступен
**Решение**: 
1. Проверьте, что сервис запущен на Render/Railway
2. Проверьте URL в переменной окружения Vercel
3. Проверьте логи сервиса на Render/Railway

### Проблема: Timeout ошибки
**Решение**: 
- Увеличьте timeout в Vercel (уже установлен на 300 секунд)
- Проверьте, что сервис отвечает быстро

### Проблема: CORS ошибки
**Решение**: 
- CORS уже настроен в сервисе
- Проверьте настройки Render/Railway (должны разрешать все источники)

## Альтернатива: Railway

Если Render не подходит, можно использовать Railway:

1. Установите Railway CLI: `npm i -g @railway/cli`
2. В директории `textilenova-parser-service`: `railway init`
3. `railway up` для деплоя
4. `railway domain` для получения URL

Подробнее в `textilenova-parser-service/DEPLOY.md`

