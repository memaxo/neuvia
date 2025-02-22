'use client'

import type { Session } from '@supabase/supabase-js'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { createClient } from '@/utils/supabase/client'

interface AuthContextType {
  session: Session | null
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
      } catch (error) {
        console.error('Error fetching session:', error)
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [supabase])

  return (
    <AuthContext.Provider value={{ session, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}