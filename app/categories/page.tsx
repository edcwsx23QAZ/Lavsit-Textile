'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface FabricCategory {
  id: string
  category: number
  price: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<FabricCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<number>(0)
  const [newCategory, setNewCategory] = useState({ category: 0, price: 0 })

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setCategories(data)
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleEdit = (category: FabricCategory) => {
    setEditingId(category.id)
    setEditPrice(category.price)
  }

  const handleSave = async (id: string) => {
    try {
      const category = categories.find(c => c.id === id)
      if (!category) return

      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.category,
          price: editPrice,
        }),
      })

      if (!response.ok) throw new Error('Failed to save')
      
      toast.success('Категория обновлена')
      setEditingId(null)
      fetchCategories()
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message)
    }
  }

  const handleAdd = async () => {
    if (newCategory.category <= 0 || newCategory.price <= 0) {
      toast.error('Заполните все поля')
      return
    }

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory),
      })

      if (!response.ok) throw new Error('Failed to add')
      
      toast.success('Категория добавлена')
      setNewCategory({ category: 0, price: 0 })
      fetchCategories()
    } catch (error: any) {
      toast.error('Ошибка добавления: ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить категорию?')) return

    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success('Категория удалена')
      fetchCategories()
    } catch (error: any) {
      toast.error('Ошибка удаления: ' + error.message)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Категории тканей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Добавить категорию</h3>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Номер категории"
                value={newCategory.category || ''}
                onChange={(e) => setNewCategory({ ...newCategory, category: parseInt(e.target.value) || 0 })}
                className="w-32"
              />
              <Input
                type="number"
                placeholder="Цена"
                value={newCategory.price || ''}
                onChange={(e) => setNewCategory({ ...newCategory, price: parseFloat(e.target.value) || 0 })}
                className="w-32"
              />
              <Button onClick={handleAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Категория</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.category} категория
                    </TableCell>
                    <TableCell>
                      {editingId === category.id ? (
                        <Input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                          className="w-32"
                        />
                      ) : (
                        formatCurrency(category.price)
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === category.id ? (
                          <Button
                            size="sm"
                            onClick={() => handleSave(category.id)}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Сохранить
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(category)}
                            >
                              Редактировать
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

