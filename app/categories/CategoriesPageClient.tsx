'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'

interface FabricCategory {
  id: string
  category: number
  price: number
}

interface CategoriesPageClientProps {
  initialCategories: FabricCategory[]
}

export function CategoriesPageClient({ initialCategories }: CategoriesPageClientProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')

  const handleEdit = (category: FabricCategory) => {
    setEditingId(category.id)
    setEditPrice(category.price.toString())
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditPrice('')
  }

  const handleSave = async (id: string) => {
    try {
      const price = parseFloat(editPrice)
      if (isNaN(price) || price <= 0) {
        toast.error('Некорректная цена')
        return
      }

      const response = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      })

      if (!response.ok) throw new Error('Failed to update category')

      setCategories(prev =>
        prev.map(cat => (cat.id === id ? { ...cat, price } : cat))
      )

      setEditingId(null)
      setEditPrice('')
      toast.success('Категория обновлена')
    } catch (error: any) {
      toast.error('Ошибка обновления: ' + error.message)
    }
  }

  return (
    <div className="rounded-md border w-fit">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24 pr-2">Категория</TableHead>
            <TableHead className="w-32 pr-2">Максимальная цена (₽)</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium whitespace-nowrap w-24 pr-2">
                Категория {category.category}
              </TableCell>
              <TableCell className="whitespace-nowrap w-32 pr-2">
                {editingId === category.id ? (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="price" className="sr-only">Цена:</Label>
                    <Input
                      id="price"
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-32"
                    />
                    <Button onClick={() => handleSave(category.id)} size="sm">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  category.price.toLocaleString('ru')
                )}
              </TableCell>
              <TableCell className="w-16">
                {editingId !== category.id && (
                  <Button onClick={() => handleEdit(category)} variant="outline" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
