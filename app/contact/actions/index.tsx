'use server'

import { createClient } from '@/lib/supabase/server'

type FormData = {
  name: string
  email: string
  message: string
}

type FormResponse = {
  success: boolean
  data?: any
  error?: string
}

export async function updateInqueries(data: FormData): Promise<FormResponse> {
  const supabase = await createClient()

  try {
    const { data: inqueries, error } = await supabase
      .from('inqueries')
      .insert({
        name: data.name,
        email: data.email,
        message: data.message,
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      throw error
    }

    return {
      success: true,
      data: inqueries,
    }
  } catch (error) {
    console.error('Error updating inqueries:', error)
    return {
      success: false,
      error: 'Failed to send message. Please try again later.',
    }
  }
}
