import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const { emailConfig } = body

    if (!emailConfig) {
      return NextResponse.json(
        { error: 'Email configuration is required' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Validate email config structure
    if (!emailConfig.host || !emailConfig.user || !emailConfig.password) {
      return NextResponse.json(
        { error: 'Host, user, and password are required' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Update supplier with email config and set parsing method to email
    await prisma.supplier.update({
      where: { id: params.id },
      data: {
        emailConfig: JSON.stringify(emailConfig),
        parsingMethod: 'email',
        // parsingUrl can be empty for email type
        parsingUrl: supplier.parsingUrl || '',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Email configuration saved',
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('Error saving email config:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to save email configuration' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        emailConfig: true,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    let emailConfig = null
    try {
      emailConfig = supplier.emailConfig
        ? JSON.parse(supplier.emailConfig)
        : null
    } catch (parseError: any) {
      console.error('Error parsing email config JSON:', parseError)
      return NextResponse.json(
        { error: 'Invalid email configuration format in database' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return NextResponse.json({
      emailConfig,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    console.error('Error fetching email config:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch email configuration' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

