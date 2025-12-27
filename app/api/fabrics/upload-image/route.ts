import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'
import { writeFile } from 'fs/promises'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fabricId = formData.get('fabricId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!fabricId) {
      return NextResponse.json(
        { error: 'Fabric ID is required' },
        { status: 400 }
      )
    }

    // Проверяем, что ткань существует
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
    })

    if (!fabric) {
      return NextResponse.json(
        { error: 'Fabric not found' },
        { status: 404 }
      )
    }

    // Создаем директорию для изображений
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'fabrics', fabric.supplierId)
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
    }

    // Генерируем уникальное имя файла
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `${fabricId}.${fileExtension}`
    const filePath = path.join(imagesDir, fileName)

    // Сохраняем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(filePath, buffer)

    // Генерируем URL для доступа к изображению
    const imageUrl = `/images/fabrics/${fabric.supplierId}/${fileName}`

    // Обновляем запись ткани
    await prisma.fabric.update({
      where: { id: fabricId },
      data: {
        imageUrl,
      },
    })

    return NextResponse.json({
      success: true,
      imageUrl,
    })
  } catch (error: any) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    )
  }
}

