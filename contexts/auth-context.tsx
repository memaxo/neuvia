'use client'

import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'

import { createBrowserClient } from '@/lib/supabase/clients'

interface AuthContextType {
  session: Session | null
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const supabase = createBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setSession(session)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching session:', error)
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session)
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [supabase])

  const authValue = useMemo(
    () => ({ session, isLoading, logout }),
    [session, isLoading, logout]
  )

  return (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
