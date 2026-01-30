import axios from 'axios'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

// URL внешнего сервиса парсера (из переменной окружения)
const PARSER_SERVICE_URL = process.env.TEXTILENOVA_PARSER_SERVICE_URL

export class TextileNovaParser extends BaseParser {
  /**
   * Вызывает внешний сервис парсера для анализа
   */
  private async callExternalService(endpoint: string, data: any): Promise<any> {
    if (!PARSER_SERVICE_URL) {
      throw new Error('TEXTILENOVA_PARSER_SERVICE_URL не настроен. Внешний сервис недоступен.')
    }

    const url = `${PARSER_SERVICE_URL}${endpoint}`
    console.log(`[TextileNovaParser] Вызов внешнего сервиса: ${url}`)

    try {
      const response = await axios.post(url, data, {
        timeout: 60000, // 60 секунд
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.error || 'Ошибка внешнего сервиса')
      }
    } catch (error: any) {
      console.error(`[TextileNovaParser] Ошибка вызова внешнего сервиса:`, error.message)
      
      if (error.response) {
        // Сервер ответил с ошибкой
        throw new Error(`Внешний сервис вернул ошибку: ${error.response.data?.error || error.response.statusText}`)
      } else if (error.request) {
        // Запрос был отправлен, но ответа не получено
        throw new Error(`Внешний сервис недоступен: ${error.message}`)
      } else {
        // Ошибка при настройке запроса
        throw new Error(`Ошибка при вызове внешнего сервиса: ${error.message}`)
      }
    }
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    console.log(`[TextileNovaParser] Используем внешний сервис для парсинга`)
    console.log(`[TextileNovaParser] URL: ${url}`)

    // Проверка на пустой URL
    if (!url || url.trim() === '') {
      throw new Error('URL не может быть пустым')
    }

    // Валидация URL
    try {
      new URL(url)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      throw new Error(`Невалидный URL: ${url}. Ошибка: ${errorMessage}`)
    }

    // Вызываем внешний сервис
    const result = await this.callExternalService('/parse', {
      url,
      rules,
    })

    // Преобразуем даты из строк в Date объекты
    const parsedFabrics: ParsedFabric[] = result.map((fabric: any) => ({
      ...fabric,
      nextArrivalDate: fabric.nextArrivalDate ? new Date(fabric.nextArrivalDate) : null,
    }))

    console.log(`[TextileNovaParser] Получено тканей: ${parsedFabrics.length}`)
    return parsedFabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    console.log(`[TextileNovaParser] Используем внешний сервис для анализа`)
    console.log(`[TextileNovaParser] URL: ${url}`)

    // Проверка на пустой URL
    if (!url || url.trim() === '') {
      throw new Error('URL не может быть пустым')
    }

    // Валидация URL
    try {
      new URL(url)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      throw new Error(`Невалидный URL: ${url}. Ошибка: ${errorMessage}`)
    }

    // Вызываем внешний сервис
    const result = await this.callExternalService('/analyze', {
      url,
    })

    return result
  }
}
