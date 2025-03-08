import { NextResponse } from 'next/server'

export function apiSuccess(data: any, status: number = 200) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status })
}

interface ApiErrorOptions {
  message: string
  status?: number
  error?: string
  errors?: unknown
}

export function apiError({
  message,
  status = 500,
  error,
  errors
}: ApiErrorOptions) {
  return NextResponse.json({
    success: false,
    error: {
      message,
      code: error,
      details: errors
    },
    timestamp: new Date().toISOString()
  }, { status })
}