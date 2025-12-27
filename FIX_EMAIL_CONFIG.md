# Исправление ошибки emailConfig

## Проблема
Prisma Client не знает о поле `emailConfig` в модели `Supplier`, хотя оно есть в схеме.

## Решение

### Вариант 1: Перезапустить dev сервер (рекомендуется)

1. **Остановите dev сервер** (Ctrl+C в терминале где запущен `npm run dev`)
2. Выполните команду:
   ```bash
   npx prisma generate
   ```
3. **Перезапустите dev сервер**:
   ```bash
   npm run dev
   ```

### Вариант 2: Если вариант 1 не помог

1. Остановите dev сервер
2. Удалите папку `.prisma`:
   ```bash
   rm -rf node_modules/.prisma
   ```
   Или в Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force node_modules\.prisma
   ```
3. Выполните:
   ```bash
   npx prisma generate
   ```
4. Перезапустите dev сервер

### Вариант 3: Принудительное обновление базы данных

Если поле не было добавлено в базу данных:

1. Остановите dev сервер
2. Выполните:
   ```bash
   npx prisma db push --force-reset
   ```
   ⚠️ **Внимание**: Это удалит все данные! Используйте только для разработки.

   Или безопаснее:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
3. Перезапустите dev сервер

## Проверка

После выполнения любого из вариантов, попробуйте снова сохранить настройки email. Ошибка должна исчезнуть.


