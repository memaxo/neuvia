import React, { useTransition } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

import { logout } from '@/app/auth/actions'
import SignOut from '@/app/dashboard/components/SignOut'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function page() {
  return (
    <div className="items-centered container px-4 py-8">
      <div className="mt-6">
        <h1 className="mb-4 text-center text-2xl font-semibold tracking-tight">
          Sign out of Neuvia
        </h1>
        <SignOut />
      </div>
    </div>
  )
}
