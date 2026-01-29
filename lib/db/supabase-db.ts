/**
 * Обертка для работы с базой данных через Supabase API
 * Заменяет Prisma для работы через REST API
 */

import { supabaseAdmin } from '@/lib/supabase/client'

// Типы для моделей
export interface Supplier {
  id: string
  name: string
  websiteUrl: string
  parsingMethod: string
  parsingUrl: string
  emailConfig?: string | null
  fabricsCount: number
  lastParsedCount?: number | null
  lastUpdatedAt?: Date | null
  status: string
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Fabric {
  id: string
  supplierId: string
  collection: string
  colorNumber: string
  inStock?: boolean | null
  meterage?: number | null
  price?: number | null
  pricePerMeter?: number | null
  category?: number | null
  imageUrl?: string | null
  colorHex?: string | null
  fabricType?: string | null
  description?: string | null
  lastUpdatedAt: Date
  nextArrivalDate?: Date | null
  comment?: string | null
  excludedFromParsing: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FabricCategory {
  id: string
  category: number
  price: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Базовый класс для работы с таблицами через Supabase API
 */
class SupabaseTable<T> {
  constructor(private tableName: string) {}

  async findMany(options?: {
    where?: Record<string, any>
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
    include?: Record<string, boolean>
  }): Promise<T[]> {
    let query = supabaseAdmin.from(this.tableName).select('*')

    // Применяем фильтры
    if (options?.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'boolean') {
            query = query.eq(key, value)
          } else if (typeof value === 'string') {
            query = query.eq(key, value)
          } else if (typeof value === 'number') {
            query = query.eq(key, value)
          }
        }
      })
    }

    // Применяем сортировку
    if (options?.orderBy) {
      Object.entries(options.orderBy).forEach(([key, order]) => {
        query = query.order(key, { ascending: order === 'asc' })
      })
    }

    // Применяем лимит
    if (options?.take) {
      query = query.limit(options.take)
    }

    // Применяем offset
    if (options?.skip) {
      query = query.range(options.skip, options.skip + (options.take || 1000) - 1)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Error fetching ${this.tableName}: ${error.message}`)
    }

    return (data || []) as T[]
  }

  async findUnique(options: { where: Record<string, any> }): Promise<T | null> {
    const { where } = options
    const key = Object.keys(where)[0]
    const value = where[key]

    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('*')
      .eq(key, value)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Error fetching ${this.tableName}: ${error.message}`)
    }

    return data as T
  }

  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabaseAdmin
      .from(this.tableName)
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`Error creating ${this.tableName}: ${error.message}`)
    }

    return result as T
  }

  async update(options: {
    where: Record<string, any>
    data: Partial<T>
  }): Promise<T> {
    const { where, data } = options
    const key = Object.keys(where)[0]
    const value = where[key]

    const { data: result, error } = await supabaseAdmin
      .from(this.tableName)
      .update(data)
      .eq(key, value)
      .select()
      .single()

    if (error) {
      throw new Error(`Error updating ${this.tableName}: ${error.message}`)
    }

    return result as T
  }

  async delete(options: { where: Record<string, any> }): Promise<void> {
    const { where } = options
    const key = Object.keys(where)[0]
    const value = where[key]

    const { error } = await supabaseAdmin
      .from(this.tableName)
      .delete()
      .eq(key, value)

    if (error) {
      throw new Error(`Error deleting ${this.tableName}: ${error.message}`)
    }
  }

  async count(options?: { where?: Record<string, any> }): Promise<number> {
    let query = supabaseAdmin.from(this.tableName).select('*', { count: 'exact', head: true })

    if (options?.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Error counting ${this.tableName}: ${error.message}`)
    }

    return count || 0
  }
}

// Экспортируем экземпляры для каждой таблицы
export const suppliers = new SupabaseTable<Supplier>('Supplier')
export const fabrics = new SupabaseTable<Fabric>('Fabric')
export const fabricCategories = new SupabaseTable<FabricCategory>('FabricCategory')

/**
 * Проверка подключения к базе данных через Supabase API
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean
  error: string | null
}> {
  try {
    // Пробуем простой запрос
    const { error } = await supabaseAdmin.from('Supplier').select('id').limit(1)
    
    if (error) {
      // Если таблицы нет, это нормально - миграции еще не применены
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return {
          connected: true,
          error: 'Таблицы еще не созданы. Примените миграции.',
        }
      }
      
      return {
        connected: false,
        error: error.message,
      }
    }
    
    return {
      connected: true,
      error: null,
    }
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Unknown error',
    }
  }
}



