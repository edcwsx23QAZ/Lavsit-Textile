/**
 * Утилиты для работы с категориями тканей
 */

export interface FabricCategory {
  id: string
  category: number
  price: number
}

/**
 * Категории тканей по умолчанию
 */
export const DEFAULT_CATEGORIES: Array<{ category: number; price: number }> = [
  { category: 1, price: 550 },
  { category: 2, price: 650 },
  { category: 3, price: 800 },
  { category: 4, price: 1000 },
  { category: 5, price: 1250 },
  { category: 6, price: 1550 },
  { category: 7, price: 1900 },
  { category: 8, price: 2300 },
  { category: 9, price: 2750 },
  { category: 10, price: 3250 },
  { category: 11, price: 3800 },
  { category: 12, price: 4400 },
  { category: 13, price: 5050 },
  { category: 14, price: 5750 },
  { category: 15, price: 6500 },
  { category: 16, price: 7300 },
]

/**
 * Определяет категорию ткани по цене за метр погонный
 * @param pricePerMeter Цена за метр погонный
 * @param categories Массив категорий, отсортированный по возрастанию цены
 * @returns Номер категории или null, если цена не попадает ни в одну категорию
 */
export function getCategoryByPrice(
  pricePerMeter: number | null | undefined,
  categories: Array<{ category: number; price: number }>
): number | null {
  if (!pricePerMeter || pricePerMeter <= 0) {
    return null
  }

  // Сортируем категории по возрастанию цены
  const sortedCategories = [...categories].sort((a, b) => a.price - b.price)

  // Логика выбора категории:
  // Цена должна быть <= стоимости категории, но > предыдущей
  // Исключение - последняя категория: любая цена >= стоимости категории относится к ней
  for (let i = 0; i < sortedCategories.length; i++) {
    const cat = sortedCategories[i]
    const prevPrice = i > 0 ? sortedCategories[i - 1].price : 0
    
    if (i === sortedCategories.length - 1) {
      // Последняя категория: любая цена >= стоимости категории
      if (pricePerMeter >= cat.price) {
        return cat.category
      }
    } else {
      // Обычная категория: цена > предыдущей и <= текущей
      if (pricePerMeter > prevPrice && pricePerMeter <= cat.price) {
        return cat.category
      }
    }
  }

  // Если не попали ни в одну категорию (хотя теоретически не должно произойти)
  return sortedCategories[sortedCategories.length - 1]?.category || null
}

/**
 * Вычисляет цену за метр погонный на основе общей цены и метража
 * @param price Общая цена
 * @param meterage Метраж
 * @returns Цена за метр погонный или null
 */
export function calculatePricePerMeter(
  price: number | null | undefined,
  meterage: number | null | undefined
): number | null {
  if (!price || !meterage || meterage <= 0) {
    return null
  }

  return price / meterage
}




