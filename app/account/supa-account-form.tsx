'use client'

import { type User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@/lib/supabase'

import Avatar from './avatar'

type Profile = {
  full_name: string | null
  username: string | null
  website: string | null
  avatar_url: string | null
  email: string | null
}

type ProfileError = {
  message: string
  field?: keyof Profile
}

export default function AccountForm({ user }: { user: User | null }) {
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ProfileError | null>(null)
  const [fullname, setFullname] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [website, setWebsite] = useState<string | null>(null)
  const [avatar_url, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const languages = [
    { label: 'English', value: 'en' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Spanish', value: 'es' },
    { label: 'Portuguese', value: 'pt' },
    { label: 'Russian', value: 'ru' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'Chinese', value: 'zh' },
  ] as const

  const getProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`full_name, username, website, avatar_url, email`)
        .eq('id', user?.id as string)
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setFullname(data.full_name)
        setUsername(data.username)
        setWebsite(data.website)
        setAvatarUrl(data.avatar_url)
        setEmail(data.email)
      }
    } catch (error) {
      setError({ message: 'Error loading user data' })
      toast.error('Error loading user data')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    getProfile()
  }, [user, getProfile])

  async function updateProfile({
    username,
    website,
    avatar_url,
    email,
  }: Partial<Profile>) {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.from('profiles').upsert({
        id: user?.id as string,
        full_name: fullname,
        username,
        website,
        avatar_url,
        email,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      
      toast.success('Account updated successfully')
    } catch (error) {
      setError({ message: 'Error updating profile' })
      toast.error('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full space-y-8 px-2 py-8">
      <Avatar
        email={email}
        onUpload={(url) => {
          setAvatarUrl(url)
          updateProfile({ fullname, username, website, email, avatar_url: url })
        }}
        size={144}
        uid={user?.id ?? null}
        url={avatar_url}
      />
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}
      <div className="flex flex-col">
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="email"
        >
          Email
        </label>
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled
          id="email"
          type="text"
          value={user?.email}
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="fullName"
        >
          Full Name
        </label>
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
          id="fullName"
          onChange={(e) => setFullname(e.target.value)}
          type="text"
          value={fullname || ''}
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="username"
        >
          Username
        </label>
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
          id="username"
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          value={username || ''}
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="website"
        >
          Website
        </label>
        <input
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
          id="website"
          onChange={(e) => setWebsite(e.target.value)}
          type="url"
          value={website || ''}
        />
      </div>

      <div className="grid w-full grid-cols-1 justify-evenly">
        <button
          className={buttonVariants({ variant: 'outline' })}
          disabled={loading}
          onClick={() =>
            updateProfile({ fullname, username, website, email, avatar_url })
          }
        >
          {loading ? 'Loading ...' : 'Update Account'}
        </button>
      </div>

      <div className="mb-2 flex w-full flex-col">
        <form
          action="/auth/signout"
          className="items-center space-y-8"
          method="post"
        >
          <button
            className={buttonVariants({ variant: 'outline' })}
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
