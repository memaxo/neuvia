import { type User } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

import { getUser } from '@/app/auth/actions'
import { ContactForm } from '@/components/forms/contact'
import { Icons } from '@/components/icons'
import { siteConfig } from '@/config/site'

export default async function ContactPage() {
  const { data, error } = await getUser()

  if (error || !data?.user) {
    redirect('/auth')
  }

  return (
    <div className="mt-10 px-2 lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Link className="mb-8 flex items-center space-x-2" href="/">
            <Icons.logo className="size-6" />
            <span className="inline-block font-bold">{siteConfig.name}</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Contact Us</h1>
          <p className="text-sm text-muted-foreground">
            Rather talk? Call us at +1-555-867-5309.
          </p>
        </div>
        <ContactForm />
      </div>
    </div>
  )
}
