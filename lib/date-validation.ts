/**
 * Валидирует дату перед сохранением в базу данных
 * @param date Дата для валидации
 * @returns Валидная дата или null
 */
export function validateDate(date: Date | null | undefined): Date | null {
  if (!date) return null
  
  // Проверяем, что дата валидна
  if (isNaN(date.getTime())) {
    return null
  }
  
  // Проверяем, что дата находится в разумных пределах (1900-2100)
  const year = date.getFullYear()
  if (year < 1900 || year > 2100) {
    return null
  }
  
  return date
}

/**
 * Валидирует и очищает объект ткани перед сохранением в базу данных
 */
export function validateFabricForDatabase(fabric: any): any {
  return {
    ...fabric,
    nextArrivalDate: validateDate(fabric.nextArrivalDate),
  }
}



