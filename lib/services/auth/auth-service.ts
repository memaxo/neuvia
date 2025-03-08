import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import { AUTH_ERROR_CODES } from '@/lib/errors/error-codes'

/**
 * Service for handling authentication operations
 */
export class AuthService {
  private supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }

  /**
   * Get the current authenticated user
   */
  async getCurrentUser() {
    try {
      return await this.supabase.auth.getUser()
    } catch (error) {
      console.error('Failed to get current user:', error)
      throw error
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    try {
      return await this.supabase.auth.signInWithPassword({
        email,
        password
      })
    } catch (error) {
      console.error('Failed to sign in with password:', error)
      throw error
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    try {
      return await this.supabase.auth.signUp({
        email,
        password
      })
    } catch (error) {
      console.error('Failed to sign up:', error)
      throw error
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    try {
      return await this.supabase.auth.signOut()
    } catch (error) {
      console.error('Failed to sign out:', error)
      throw error
    }
  }

  /**
   * Get session
   */
  async getSession() {
    try {
      return await this.supabase.auth.getSession()
    } catch (error) {
      console.error('Failed to get session:', error)
      throw error
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    try {
      return await this.supabase.auth.resetPasswordForEmail(email)
    } catch (error) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }

  /**
   * Update user
   */
  async updateUser(updates: { email?: string; password?: string; data?: Record<string, any> }) {
    try {
      return await this.supabase.auth.updateUser(updates)
    } catch (error) {
      console.error('Failed to update user:', error)
      throw error
    }
  }
}

// Export singleton instance
export const authService = new AuthService()