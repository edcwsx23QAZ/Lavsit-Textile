-- CreateTable
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "websiteUrl" TEXT NOT NULL,
    "parsingMethod" TEXT NOT NULL,
    "parsingUrl" TEXT NOT NULL,
    "emailConfig" TEXT,
    "fabricsCount" INTEGER NOT NULL DEFAULT 0,
    "lastParsedCount" INTEGER,
    "lastUpdatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Fabric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "colorNumber" TEXT NOT NULL,
    "inStock" BOOLEAN,
    "meterage" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "pricePerMeter" DOUBLE PRECISION,
    "category" INTEGER,
    "imageUrl" TEXT,
    "colorHex" TEXT,
    "fabricType" TEXT,
    "description" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextArrivalDate" TIMESTAMP(3),
    "comment" TEXT,
    "excludedFromParsing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Fabric_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ParsingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL UNIQUE,
    "rules" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParsingRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DataStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL UNIQUE,
    "structure" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataStructure_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT,
    "attachmentName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailAttachment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FabricCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" INTEGER NOT NULL UNIQUE,
    "price" DOUBLE PRECISION NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManualUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastParserUpdate" TIMESTAMP(3),
    "metadata" TEXT,
    CONSTRAINT "ManualUpload_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_supplierId_idx" ON "Fabric"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_collection_idx" ON "Fabric"("collection");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_lastUpdatedAt_idx" ON "Fabric"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_category_idx" ON "Fabric"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_excludedFromParsing_idx" ON "Fabric"("excludedFromParsing");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_supplierId_collection_colorNumber_idx" ON "Fabric"("supplierId", "collection", "colorNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_inStock_excludedFromParsing_idx" ON "Fabric"("inStock", "excludedFromParsing");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fabric_supplierId_excludedFromParsing_idx" ON "Fabric"("supplierId", "excludedFromParsing");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailAttachment_supplierId_idx" ON "EmailAttachment"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailAttachment_messageId_idx" ON "EmailAttachment"("messageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailAttachment_processed_idx" ON "EmailAttachment"("processed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManualUpload_supplierId_idx" ON "ManualUpload"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManualUpload_type_idx" ON "ManualUpload"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ManualUpload_isActive_idx" ON "ManualUpload"("isActive");

