# Структура проекта Lavsit Textile

## Общая структура

```
lavsit-textile/
├── app/                          # Next.js App Router
│   ├── api/                     # API endpoints
│   │   ├── categories/         # Управление категориями
│   │   ├── exclusions/         # Управление исключениями
│   │   ├── fabrics/            # Управление тканями
│   │   ├── jobs/               # Фоновые задачи
│   │   └── suppliers/          # Управление поставщиками
│   ├── categories/             # Страница категорий
│   ├── exclusions/             # Страница исключений
│   ├── fabrics/                # Главная страница (ткани)
│   ├── palette/                # Страница палитры цветов
│   └── suppliers/              # Страница поставщиков
├── components/                 # React компоненты
│   ├── ui/                    # UI компоненты (shadcn/ui)
│   ├── EmailSettingsDialog.tsx
│   ├── ManualUploadDialog.tsx
│   └── ParsingRulesDialog.tsx
├── data/                       # Данные и файлы
│   ├── email-attachments/     # Email вложения по поставщикам
│   ├── manual-uploads/        # Ручные загрузки по поставщикам
│   └── parsed/                # Распарсенные данные
├── docs/                       # Документация
│   ├── suppliers/             # Документация по поставщикам
│   ├── USER_GUIDE.md          # Руководство пользователя
│   ├── PERFORMANCE_ANALYSIS.md # Анализ производительности
│   └── PROJECT_STRUCTURE.md   # Этот файл
├── lib/                        # Библиотеки и утилиты
│   ├── email/                 # Email парсинг
│   ├── jobs/                  # Фоновые задачи
│   ├── parsers/               # Парсеры для поставщиков
│   ├── fabric-categories.ts   # Категории тканей
│   ├── manual-upload-utils.ts # Утилиты для ручных загрузок
│   ├── price-normalization.ts # Нормализация цен
│   └── prisma.ts              # Prisma клиент
├── prisma/                     # Prisma схема и миграции
│   ├── schema.prisma          # Схема базы данных
│   └── dev.db                 # SQLite база данных
├── scripts/                    # Вспомогательные скрипты
└── public/                     # Публичные файлы
    └── images/                # Изображения
        └── fabrics/           # Изображения тканей
```

## Организация данных по поставщикам

### Структура хранения данных

Данные для каждого поставщика хранятся в следующих местах:

#### 1. База данных (Prisma)

- **Supplier** — информация о поставщике
- **Fabric** — ткани поставщика
- **ParsingRule** — правила парсинга (JSON)
- **DataStructure** — структура данных (JSON)
- **EmailAttachment** — email вложения
- **ManualUpload** — ручные загрузки

#### 2. Файловая система

- **Email вложения:** `data/email-attachments/{supplierId}/`
- **Ручные загрузки:** `data/manual-uploads/{supplierId}/`
- **Распарсенные данные:** `data/parsed/`
- **Изображения:** `public/images/fabrics/{supplierId}/`

### Правила парсинга

Правила парсинга хранятся в БД в таблице `ParsingRule` в формате JSON:

```json
{
  "columnMappings": {
    "collection": 2,
    "color": 4,
    "meterage": 6,
    "inStock": 6,
    "nextArrivalDate": 9
  },
  "skipRows": [1, 2],
  "skipPatterns": ["Сетка"],
  "headerRow": 0,
  "specialRules": {}
}
```

### Исключения из парсинга

Исключения хранятся в поле `excludedFromParsing` таблицы `Fabric`:
- `excludedFromParsing = true` — ткань исключена из парсинга
- `excludedFromParsing = false` — ткань парсится автоматически

## Парсеры

### Структура парсеров

Все парсеры находятся в `lib/parsers/` и наследуются от `BaseParser`:

- `base-parser.ts` — базовый класс с общими методами
- `ametist-parser.ts` — парсер для Аметист
- `noframes-parser.ts` — парсер для NoFrames
- `egida-parser.ts` — парсер для Эгида
- `vektor-parser.ts` — парсер для Vektor
- `viptextil-parser.ts` — парсер для Viptextil
- `artefact-parser.ts` — парсер для Artefact
- `artvision-parser.ts` — парсер для Artvision
- `souzm-parser.ts` — парсер для Союз-М
- `domiart-parser.ts` — парсер для Домиарт
- `arteks-parser.ts` — парсер для Артекс
- `textiledata-parser.ts` — парсер для TextileData
- `textilenova-parser.ts` — парсер для TextileNova
- `texgroup-parser.ts` — парсер для Tex.Group
- `email-excel-parser.ts` — универсальный парсер для email вложений
- `auto-rules.ts` — автоматические правила парсинга

### Методы парсера

Каждый парсер должен реализовать:

1. **`parse(url: string): Promise<ParsedFabric[]>`** — парсинг данных
2. **`analyze(url: string): Promise<ParsingAnalysis>`** — анализ структуры данных

### Базовые методы (BaseParser)

- `saveRules()` — сохранение правил парсинга
- `loadRules()` — загрузка правил парсинга
- `saveDataStructure()` — сохранение структуры данных
- `compareStructure()` — сравнение структуры данных
- `parseCollectionAndColor()` — парсинг коллекции и цвета
- `parseDate()` — парсинг даты
- `parseBoolean()` — парсинг булевого значения
- `parseNumber()` — парсинг числа

## API Endpoints

### Структура API

```
/api/
├── categories/              # GET, POST, DELETE
├── exclusions/             # GET, POST, PATCH
├── fabrics/                # GET, POST
│   ├── [id]/              # GET, PATCH
│   ├── update-collection/ # PATCH
│   └── upload-image/      # POST
├── jobs/                   # POST
│   └── check-emails/      # POST
└── suppliers/             # GET, POST
    ├── [id]/              # GET
    │   ├── analyze/       # POST
    │   ├── parse/         # POST
    │   ├── parse-email/   # POST
    │   ├── email-config/  # GET, POST
    │   ├── manual-upload/ # POST
    │   └── export/        # GET
    └── parse-all/         # POST
```

## Оптимизации производительности

### Индексы базы данных

#### Fabric

- `supplierId` — индекс для фильтрации по поставщику
- `collection` — индекс для группировки
- `lastUpdatedAt` — индекс для сортировки
- `category` — индекс для фильтрации
- `excludedFromParsing` — индекс для фильтрации исключений
- `(supplierId, collection, colorNumber)` — составной индекс для поиска
- `(inStock, excludedFromParsing)` — составной индекс для фильтрации
- `(supplierId, excludedFromParsing)` — составной индекс для фильтрации по поставщику

### Кэширование

- Результаты `/api/fabrics` можно кэшировать на 1-5 минут
- Категории кэшируются в памяти (загружаются один раз)

### Вычисления

- `pricePerMeter` и `category` вычисляются на сервере при каждом запросе
- Можно оптимизировать, сохраняя вычисленные значения в БД

## Безопасность данных

### Изоляция данных

- Данные каждого поставщика изолированы через `supplierId`
- Исключения применяются на уровне БД (`excludedFromParsing`)
- Ручные загрузки имеют приоритет над парсером

### Валидация

- Валидация дат через `validateDate()`
- Нормализация цен через `normalizePrice()`
- Валидация Excel файлов перед обработкой

## Расширяемость

### Добавление нового поставщика

1. Создать парсер в `lib/parsers/{name}-parser.ts`
2. Наследовать от `BaseParser`
3. Реализовать методы `parse()` и `analyze()`
4. Добавить поставщика через скрипт `scripts/init-suppliers.ts`
5. Настроить правила парсинга через UI

### Добавление новых полей

1. Обновить схему Prisma (`prisma/schema.prisma`)
2. Выполнить миграцию (`npm run db:push`)
3. Обновить парсеры для заполнения новых полей
4. Обновить UI для отображения новых полей

