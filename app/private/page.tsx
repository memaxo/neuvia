import { redirect } from 'next/navigation'
import { getUser } from '@/app/auth/actions'

export default async function PrivatePage() {
  const { data, error } = await getUser()
  
  if (error || !data?.user) {
    redirect('/')
  }

  return <p>Hello {data.user.email}</p>
}
