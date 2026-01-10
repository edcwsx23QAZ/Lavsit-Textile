'use client'

import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, formatMeterage } from '@/lib/utils'
import { Check, X, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'

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

interface FabricsTableProps {
  fabrics: Fabric[]
}

type SortField = 'collection' | 'colorNumber' | 'supplier' | 'meterage' | 'price' | 'inStock' | null
type SortDirection = 'asc' | 'desc'

export function FabricsTable({ fabrics: initialFabrics }: FabricsTableProps) {
  const [fabrics] = useState(initialFabrics)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedFabrics = useMemo(() => {
    if (!sortField) return fabrics

    return [...fabrics].sort((a, b) => {
      let aVal: any
      let bVal: any

      switch (sortField) {
        case 'collection':
          aVal = a.collection
          bVal = b.collection
          break
        case 'colorNumber':
          aVal = a.colorNumber
          bVal = b.colorNumber
          break
        case 'supplier':
          aVal = a.supplier.name
          bVal = b.supplier.name
          break
        case 'meterage':
          aVal = a.meterage ?? 0
          bVal = b.meterage ?? 0
          break
        case 'price':
          aVal = a.price ?? 0
          bVal = b.price ?? 0
          break
        case 'inStock':
          aVal = a.inStock === true ? 1 : a.inStock === false ? 0 : -1
          bVal = b.inStock === true ? 1 : b.inStock === false ? 0 : -1
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [fabrics, sortField, sortDirection])

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-8 gap-1"
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
      )}
      {sortField !== field && <ArrowUpDown className="h-4 w-4 opacity-50" />}
    </Button>
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Изобр.</TableHead>
            <TableHead>
              <SortButton field="supplier">Поставщик</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="collection">Коллекция</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="colorNumber">Цвет</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="meterage">Метраж</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="price">Цена</SortButton>
            </TableHead>
            <TableHead className="text-right">Цена/м</TableHead>
            <TableHead className="text-center">
              <SortButton field="inStock">В наличии</SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFabrics.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Ткани не найдены
              </TableCell>
            </TableRow>
          ) : (
            sortedFabrics.map((fabric) => (
              <TableRow key={fabric.id}>
                <TableCell>
                  {fabric.imageUrl ? (
                    <Image
                      src={fabric.imageUrl}
                      alt={`${fabric.collection} ${fabric.colorNumber}`}
                      width={40}
                      height={40}
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-muted rounded" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{fabric.supplier.name}</TableCell>
                <TableCell>{fabric.collection}</TableCell>
                <TableCell>{fabric.colorNumber}</TableCell>
                <TableCell className="text-right">
                  {fabric.meterage !== null ? formatMeterage(fabric.meterage) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {fabric.price !== null ? formatCurrency(fabric.price) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {fabric.pricePerMeter !== null ? formatCurrency(fabric.pricePerMeter) : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {fabric.inStock === true ? (
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Да
                    </Badge>
                  ) : fabric.inStock === false ? (
                    <Badge variant="secondary">
                      <X className="h-3 w-3 mr-1" />
                      Нет
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}




