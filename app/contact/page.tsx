import React from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supa-server-actions'
import { type User } from '@supabase/supabase-js'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { siteConfig } from '@/config/site'
import { Contact } from '@/components/forms/contact'
import { Icons } from '@/components/icons'

export default async function ContactPage() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth')
  }

  return (
    <div className="mt-10 px-2 lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Link href="/" className="mb-8 flex items-center space-x-2">
            <Icons.logo className="h-6 w-6" />
            <span className="inline-block font-bold">{siteConfig.name}</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Contact Us</h1>
          <p className="text-sm text-muted-foreground">
            Rather talk? Call us at +1-555-867-5309.
          </p>
        </div>
        <Contact />
      </div>
    </div>
  )
}
