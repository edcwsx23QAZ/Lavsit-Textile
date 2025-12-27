-- CreateTable
CREATE TABLE IF NOT EXISTS "FabricCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManualUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastParserUpdate" DATETIME,
    "metadata" TEXT,
    CONSTRAINT "ManualUpload_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
-- Добавляем новые поля в таблицу Fabric, если их еще нет
-- SQLite не поддерживает ALTER TABLE ADD COLUMN IF NOT EXISTS, поэтому используем проверку через PRAGMA
-- Вместо этого добавим колонки напрямую, если они не существуют

-- Добавляем pricePerMeter, если его нет
-- SQLite не поддерживает IF NOT EXISTS для ALTER TABLE, поэтому используем try-catch в коде
-- Или добавляем через отдельные команды

-- Для SQLite нужно проверить существование колонки перед добавлением
-- Это делается через PRAGMA table_info, но в миграции проще добавить колонки напрямую
-- Если колонка уже существует, миграция упадет, но это нормально для разработки

-- Добавляем pricePerMeter
ALTER TABLE "Fabric" ADD COLUMN "pricePerMeter" REAL;

-- Добавляем category
ALTER TABLE "Fabric" ADD COLUMN "category" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FabricCategory_category_key" ON "FabricCategory"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "FabricCategory_price_key" ON "FabricCategory"("price");
CREATE INDEX IF NOT EXISTS "ManualUpload_supplierId_idx" ON "ManualUpload"("supplierId");
CREATE INDEX IF NOT EXISTS "ManualUpload_type_idx" ON "ManualUpload"("type");
CREATE INDEX IF NOT EXISTS "ManualUpload_isActive_idx" ON "ManualUpload"("isActive");
CREATE INDEX IF NOT EXISTS "Fabric_category_idx" ON "Fabric"("category");


