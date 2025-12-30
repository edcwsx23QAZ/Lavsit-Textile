/**
 * Оптимизированные функции фильтрации тканей
 * Использует индексы для быстрого поиска
 */

interface Fabric {
  id: string
  collection: string
  colorNumber: string
  inStock: boolean | null
  meterage: number | null
  price: number | null
  pricePerMeter: number | null
  category: number | null
  imageUrl: string | null
  fabricType: string | null
  description: string | null
  lastUpdatedAt: Date
  nextArrivalDate: Date | null
  comment: string | null
  supplier: {
    id: string
    name: string
    websiteUrl: string
  }
}

interface FilterOptions {
  supplierId?: string | null
  search?: string
  showOnlyInStock?: boolean
  fabricType?: string[]
  category?: number | null
  collection?: string
}

/**
 * Класс для индексации и быстрой фильтрации тканей
 */
export class FabricIndexer {
  private fabrics: Fabric[]
  private indexes: {
    bySupplierId: Map<string, Set<number>>
    byCollection: Map<string, Set<number>>
    byFabricType: Map<string, Set<number>>
    byCategory: Map<number, Set<number>>
    byInStock: Map<boolean | null, Set<number>>
    searchIndex: Map<string, Set<number>> // для полнотекстового поиска
  }

  constructor(fabrics: Fabric[]) {
    this.fabrics = fabrics
    this.indexes = {
      bySupplierId: new Map(),
      byCollection: new Map(),
      byFabricType: new Map(),
      byCategory: new Map(),
      byInStock: new Map(),
      searchIndex: new Map(),
    }
    this.buildIndexes()
  }

  /**
   * Построить индексы для быстрого поиска
   */
  private buildIndexes() {
    this.fabrics.forEach((fabric, index) => {
      // Индекс по поставщику
      const supplierKey = fabric.supplier.id
      if (!this.indexes.bySupplierId.has(supplierKey)) {
        this.indexes.bySupplierId.set(supplierKey, new Set())
      }
      this.indexes.bySupplierId.get(supplierKey)!.add(index)

      // Индекс по коллекции
      const collectionKey = fabric.collection.toLowerCase()
      if (!this.indexes.byCollection.has(collectionKey)) {
        this.indexes.byCollection.set(collectionKey, new Set())
      }
      this.indexes.byCollection.get(collectionKey)!.add(index)

      // Индекс по типу ткани
      if (fabric.fabricType) {
        const fabricTypeKey = fabric.fabricType.toLowerCase()
        if (!this.indexes.byFabricType.has(fabricTypeKey)) {
          this.indexes.byFabricType.set(fabricTypeKey, new Set())
        }
        this.indexes.byFabricType.get(fabricTypeKey)!.add(index)
      }

      // Индекс по категории
      if (fabric.category !== null && fabric.category !== undefined) {
        if (!this.indexes.byCategory.has(fabric.category)) {
          this.indexes.byCategory.set(fabric.category, new Set())
        }
        this.indexes.byCategory.get(fabric.category)!.add(index)
      }

      // Индекс по наличию
      const inStockKey = fabric.inStock ?? null
      if (!this.indexes.byInStock.has(inStockKey)) {
        this.indexes.byInStock.set(inStockKey, new Set())
      }
      this.indexes.byInStock.get(inStockKey)!.add(index)

      // Поисковый индекс (коллекция + цвет + поставщик)
      const searchTerms = [
        fabric.collection.toLowerCase(),
        fabric.colorNumber.toLowerCase(),
        fabric.supplier.name.toLowerCase(),
        fabric.fabricType?.toLowerCase() || '',
        fabric.description?.toLowerCase() || '',
      ].join(' ')

      // Индексируем каждое слово
      searchTerms.split(/\s+/).forEach(term => {
        if (term.length >= 2) {
          if (!this.indexes.searchIndex.has(term)) {
            this.indexes.searchIndex.set(term, new Set())
          }
          this.indexes.searchIndex.get(term)!.add(index)
        }
      })
    })
  }

  /**
   * Быстрая фильтрация через индексы
   */
  filter(options: FilterOptions): Fabric[] {
    let resultIndices: Set<number> | null = null

    // Фильтр по поставщику
    if (options.supplierId) {
      const indices = this.indexes.bySupplierId.get(options.supplierId)
      if (!indices || indices.size === 0) {
        return []
      }
      resultIndices = new Set(indices)
    }

    // Фильтр по коллекции
    if (options.collection) {
      const indices = this.indexes.byCollection.get(options.collection.toLowerCase())
      if (!indices || indices.size === 0) {
        return []
      }
      if (resultIndices) {
        // Пересечение множеств
        resultIndices = new Set([...resultIndices].filter(i => indices.has(i)))
        if (resultIndices.size === 0) return []
      } else {
        resultIndices = new Set(indices)
      }
    }

    // Фильтр по типу ткани
    if (options.fabricType && options.fabricType.length > 0) {
      const indices = new Set<number>()
      options.fabricType.forEach(type => {
        const typeIndices = this.indexes.byFabricType.get(type.toLowerCase())
        if (typeIndices) {
          typeIndices.forEach(i => indices.add(i))
        }
      })
      if (indices.size === 0) {
        return []
      }
      if (resultIndices) {
        resultIndices = new Set([...resultIndices].filter(i => indices.has(i)))
        if (resultIndices.size === 0) return []
      } else {
        resultIndices = new Set(indices)
      }
    }

    // Фильтр по категории
    if (options.category !== null && options.category !== undefined) {
      const indices = this.indexes.byCategory.get(options.category)
      if (!indices || indices.size === 0) {
        return []
      }
      if (resultIndices) {
        resultIndices = new Set([...resultIndices].filter(i => indices.has(i)))
        if (resultIndices.size === 0) return []
      } else {
        resultIndices = new Set(indices)
      }
    }

    // Фильтр по наличию
    if (options.showOnlyInStock) {
      const indices = this.indexes.byInStock.get(true)
      if (!indices || indices.size === 0) {
        return []
      }
      if (resultIndices) {
        resultIndices = new Set([...resultIndices].filter(i => indices.has(i)))
        if (resultIndices.size === 0) return []
      } else {
        resultIndices = new Set(indices)
      }
    }

    // Поиск по тексту
    if (options.search && options.search.trim()) {
      const searchTerms = options.search.toLowerCase().trim().split(/\s+/)
      const searchIndices = new Set<number>()

      if (searchTerms.length > 0) {
        // Находим индексы для каждого слова
        const termIndices: Set<number>[] = []
        searchTerms.forEach(term => {
          if (term.length >= 2) {
            // Ищем частичные совпадения в индексе
            for (const [key, indices] of this.indexes.searchIndex.entries()) {
              if (key.includes(term) || term.includes(key)) {
                termIndices.push(indices)
              }
            }
          }
        })

        if (termIndices.length > 0) {
          // Объединение индексов (хотя бы одно слово должно совпадать)
          // Но лучше делать пересечение - все слова должны быть найдены
          const allMatchingIndices = new Set<number>()
          termIndices.forEach(indices => {
            indices.forEach(idx => allMatchingIndices.add(idx))
          })

          // Если несколько слов - находим пересечение
          if (termIndices.length > 1) {
            termIndices[0].forEach(idx => {
              let matchesAll = true
              for (let i = 1; i < termIndices.length; i++) {
                if (!termIndices[i].has(idx)) {
                  matchesAll = false
                  break
                }
              }
              if (matchesAll) {
                searchIndices.add(idx)
              }
            })
          } else {
            termIndices[0].forEach(idx => searchIndices.add(idx))
          }
        } else {
          // Если не нашли по индексу, делаем полный перебор
          // Это медленнее, но работает для редких случаев
          const searchLower = options.search.toLowerCase()
          this.fabrics.forEach((fabric, index) => {
            const searchText = [
              fabric.collection,
              fabric.colorNumber,
              fabric.supplier.name,
              fabric.fabricType,
              fabric.description,
            ].filter(Boolean).join(' ').toLowerCase()
            
            if (searchText.includes(searchLower)) {
              searchIndices.add(index)
            }
          })
        }
      }

      if (searchIndices.size === 0 && options.search.trim().length > 0) {
        return []
      }

      if (resultIndices) {
        resultIndices = new Set([...resultIndices].filter(i => searchIndices.has(i)))
        if (resultIndices.size === 0) return []
      } else {
        resultIndices = new Set(searchIndices)
      }
    }

    // Если нет фильтров, возвращаем все
    if (!resultIndices) {
      return [...this.fabrics]
    }

    // Преобразуем индексы в ткани
    const result: Fabric[] = []
    resultIndices.forEach(index => {
      result.push(this.fabrics[index])
    })

    return result
  }

  /**
   * Получить все ткани
   */
  getAll(): Fabric[] {
    return [...this.fabrics]
  }
}

/**
 * Создать индексер и отфильтровать ткани
 */
export function filterFabrics(fabrics: Fabric[], options: FilterOptions): Fabric[] {
  const indexer = new FabricIndexer(fabrics)
  return indexer.filter(options)
}

