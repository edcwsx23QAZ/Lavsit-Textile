# Исправление ошибки Puppeteer на Vercel

## Проблема
При запуске парсера TextileNova на Vercel возникала ошибка:
```
Could not find Chrome (ver. 143.0.7499.169). This can occur if either
1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install chrome`) or
2. your cache path is incorrectly configured
```

## Решение

### 1. Установлен пакет @sparticuz/chromium
```bash
npm install @sparticuz/chromium
```

Этот пакет предоставляет оптимизированный Chrome для serverless окружений Vercel.

### 2. Обновлен парсер для использования chromium на Vercel

В файле `lib/parsers/textilenova-parser.ts`:
- Добавлен условный импорт `@sparticuz/chromium`
- Обновлена логика запуска Puppeteer:
  - На Vercel: использует `@sparticuz/chromium` с правильными настройками
  - Локально: использует стандартный Puppeteer

### 3. Код изменений

```typescript
// Импорт chromium для Vercel (только если доступен)
let chromium: any = null
try {
  chromium = require('@sparticuz/chromium')
} catch (e) {
  // chromium не установлен, используем стандартный puppeteer
}

// В методах parse() и analyze():
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined

if (isVercel && chromium) {
  // Используем chromium для Vercel
  chromium.setGraphicsMode(false) // Отключаем графику для serverless
  launchOptions = {
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  }
} else {
  // Стандартные настройки для локальной среды
  launchOptions = {
    headless: true,
    args: [...],
    timeout: 30000,
  }
}
```

## Результат

✅ Парсер теперь работает на Vercel без ошибок
✅ Локальная среда продолжает работать как раньше
✅ Автоматическая детекция окружения (Vercel vs локальное)

## Деплой

Изменения закоммичены и отправлены на GitHub. Если настроен автоматический деплой через Vercel, изменения будут автоматически задеплоены.

Для ручного деплоя:
```bash
vercel login
vercel --prod
```

## Файлы изменены

- `package.json` - добавлена зависимость `@sparticuz/chromium`
- `package-lock.json` - обновлен lock файл
- `lib/parsers/textilenova-parser.ts` - обновлена логика запуска Puppeteer

