#!/bin/bash
# Применение миграций к базе данных после деплоя
echo "Применение миграций Prisma..."
npx prisma migrate deploy
echo "Миграции применены успешно!"

