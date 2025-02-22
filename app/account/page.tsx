import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getUser } from '@/app/auth/actions'
import { Separator } from '@/components/ui/separator'

import AccountForm from './supa-account-form'

export default async function SettingsAccountPage() {
  const { data, error } = await getUser()
  
  if (!data?.user) {
    redirect('/auth')
  }

  return (
    <div className="mt-10 px-2 lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 px-2">
        <div className="text-justified-center items-justified-center flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">
            Account Profile
          </h1>
          <p className="text-justify text-base">Update your account...</p>

          <Link
            className="text-1xl font-bold tracking-tighter sm:text-3xl"
            href="/playground"
            rel="noreferrer"
            target="_blank"
          >
            Check out the OpenAI Playground!
          </Link>
        </div>
        <Separator />
        <AccountForm user={data.user} />
      </div>
    </div>
  )
}
