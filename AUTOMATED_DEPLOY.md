# Автоматизированный деплой на Vercel

## Текущий статус

✅ **Выполнено:**
- Vercel CLI установлен и настроен
- Prisma schema обновлен на PostgreSQL
- Prisma Client сгенерирован
- vercel.json создан с настройками таймаутов
- Проект связан с Vercel (lavsit-textile)
- Токен Vercel сохранен: `R7r2N1maVjii1BkkRQvidtls`

⚠️ **Требуется ручное действие:**
- Создание Vercel Postgres базы данных через веб-интерфейс (API недоступен)

## Шаги для завершения деплоя

### 1. Создание Vercel Postgres базы данных (РУЧНОЙ ШАГ)

**ВАЖНО:** Vercel Postgres нельзя создать через CLI/API - требуется веб-интерфейс.

**Инструкция:**
1. Перейдите на https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в раздел **Storage**
4. Нажмите **Create Database** → выберите **Postgres**
5. После создания скопируйте **Connection String** (DATABASE_URL)

**Альтернатива (автоматизация):**
- Используйте скрипт `scripts/create-vercel-postgres.ts` для автоматизации через Puppeteer
- Запуск: `npx tsx scripts/create-vercel-postgres.ts`

### 2. Настройка переменных окружения (АВТОМАТИЗИРОВАНО)

После получения DATABASE_URL выполните:

```bash
vercel env add DATABASE_URL production --token R7r2N1maVjii1BkkRQvidtls
vercel env add DATABASE_URL preview --token R7r2N1maVjii1BkkRQvidtls
vercel env add DATABASE_URL development --token R7r2N1maVjii1BkkRQvidtls
```

### 3. Создание миграций (АВТОМАТИЗИРОВАНО)

После настройки DATABASE_URL локально:

```bash
# Установить DATABASE_URL локально (временно)
export DATABASE_URL="ваш_connection_string"

# Создать миграцию
npx prisma migrate dev --name init

# Применить миграции к production базе
npx prisma migrate deploy
```

### 4. Проверка сборки (АВТОМАТИЗИРОВАНО)

```bash
# С DATABASE_URL установленным локально
npm run build
```

### 5. Production деплой (АВТОМАТИЗИРОВАНО)

```bash
vercel --prod --token R7r2N1maVjii1BkkRQvidtls
```

## Автоматизация с токеном

Все команды можно выполнять с токеном:

```bash
vercel [команда] --token R7r2N1maVjii1BkkRQvidtls
```

Или установить как переменную окружения:

```bash
export VERCEL_TOKEN=R7r2N1maVjii1BkkRQvidtls
vercel [команда]
```

## Примечания

- Токен Vercel сохранен в `.vercel-token` (добавлен в `.gitignore`)
- Проект ID: `prj_bMA2mQ3UsVKhrjJsHqSiZ1rdj15K`
- Team ID: `team_2FyqWSswogxney3SWR8bxRzV`
- Production URL: https://lavsit-textile-narfius-projects.vercel.app


