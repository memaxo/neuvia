'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

export default function AuthButton() {
  const [session, setSession] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setSession(!!session)
    }

    checkSession()

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const onSubmit = async () => {
    startTransition(async () => {
      await logout()
    })
  }

  if (!session) {
    return <div className="hidden" />
  }

  return (
    <form action={onSubmit}>
      <Button className="flex w-full items-center gap-2" variant="outline">
        SignOut{' '}
        <AiOutlineLoading3Quarters
          className={cn('animate-spin', { hidden: !isPending })}
        />
      </Button>
    </form>
  )
}
