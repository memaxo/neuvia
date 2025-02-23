'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { User } from '@supabase/supabase-js'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useState, useTransition, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'

import { loginWithEmailAndPassword, signInWithGoogle } from '../actions'
import type { AuthResponse } from '../actions'

const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password cannot be empty' }),
  rememberMe: z.boolean().default(false).optional(),
})

type LoginFormData = z.infer<typeof LoginSchema>

interface GoogleAuthResponse {
  data?: {
    url?: string;
    user?: User | null;
  };
  error?: Error;
}

export function AuthForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const handleAuthResponse = ({ error }: AuthResponse) => {
    if (error) {
      toast({
        title: 'Authentication failed',
        description: error.message,
        variant: 'destructive',
      })
      return false
    }
    
    toast({
      title: 'Success',
      description: 'Welcome back!',
    })
    return true
  }

  const onSubmit = useCallback(async (formData: LoginFormData) => {
    startTransition(async () => {
      try {
        const response = await loginWithEmailAndPassword(formData)
        handleAuthResponse(response)
      } catch (_error) {
        toast({
          title: 'An error occurred',
          description: 'Please try again later',
          variant: 'destructive',
        })
      }
    })
  }, [handleAuthResponse])

  const handleGoogleSignIn = useCallback(async () => {
    startTransition(async () => {
      try {
        const response = await signInWithGoogle() as GoogleAuthResponse
        if (response.data?.url && response.data.url.length > 0) {
          window.location.href = response.data.url
        } else {
          handleAuthResponse(response as AuthResponse)
        }
      } catch (_error) {
        toast({
          title: 'An error occurred',
          description: 'Please try again later',
          variant: 'destructive',
        })
      }
    })
  }, [handleAuthResponse])

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev)
  }, [])

  const renderEmailField = useCallback(({ field }: { field: any }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          placeholder="name@example.com"
          type="email"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  ), [])

  const renderPasswordField = useCallback(({ field }: { field: any }) => (
    <FormItem>
      <FormLabel>Password</FormLabel>
      <FormControl>
        <div className="relative">
          <Input
            autoComplete="current-password"
            disabled={isPending}
            placeholder="Enter your password"
            type={showPassword ? 'text' : 'password'}
            {...field}
          />
          <Button
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            disabled={isPending}
            onClick={() => void togglePasswordVisibility()}
            size="sm"
            type="button"
            variant="ghost"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
            <span className="sr-only">
              {showPassword ? 'Hide password' : 'Show password'}
            </span>
          </Button>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  ), [isPending, showPassword, togglePasswordVisibility])

  const renderRememberMeField = useCallback(({ field }: { field: any }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>Remember me</FormLabel>
      </div>
    </FormItem>
  ), [])

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          <FormField
            control={form.control}
            name="email"
            render={renderEmailField}
          />
          <FormField
            control={form.control}
            name="password"
            render={renderPasswordField}
          />
          <FormField
            control={form.control}
            name="rememberMe"
            render={renderRememberMeField}
          />
          <Button
            className="w-full"
            disabled={isPending}
            type="submit"
          >
            {isPending && (
              <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
            )}
            Sign In
          </Button>
        </form>
      </Form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#35605A]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#D8E4FF] px-2 text-[#6B818C]">
            Or continue with
          </span>
        </div>
      </div>
      <Button
        disabled={isPending}
        onClick={() => void handleGoogleSignIn()}
        type="button"
        variant="outline"
      >
        {isPending ? (
          <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
        ) : (
          <Image
            alt="Google Logo"
            className="mr-2"
            height={16}
            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTIyLjU2IDEyLjI1YzAtLjc4LS4wNy0xLjUzLS4yLTIuMjVIMTJ2NC4yNmg1LjkyYy0uMjYgMS4zNy0xLjA0IDIuNTMtMi4yMSAzLjMxdjIuNzdoMy41N2MyLjA4LTEuOTIgMy4yOC00Ljc0IDMuMjgtOC4wOXoiIGZpbGw9IiM0Mjg1RjQiLz48cGF0aCBkPSJNMTIgMjNjMi45NyAwIDUuNDYtLjk4IDcuMjgtMi42NmwtMy41Ny0yLjc3Yy0uOTguNjYtMi4yMyAxLjA2LTMuNzEgMS4wNi0yLjg2IDAtNS4yOS0xLjkzLTYuMTYtNC41M0gyLjE4djIuODRDMy45OSAyMC41MyA3LjcgMjMgMTIgMjN6IiBmaWxsPSIjMzRBODUzIi8+PHBhdGggZD0iTTUuODQgMTQuMDljLS4yMi0uNjYtLjM1LTEuMzYtLjM1LTIuMDlzLjEzLTEuNDMuMzUtMi4wOVY3LjA3SDIuMThDMS40MyA4LjU1IDEgMTAuMjIgMSAxMnMuNDMgMy40NSAxLjE4IDQuOTNsMi44NS0yLjIyLjgxLS42MnoiIGZpbGw9IiNGQkJDMDUiLz48cGF0aCBkPSJNMTIgNS4zOGMxLjYyIDAgMy4wNi41NiA0LjIxIDEuNjRsMy4xNS0zLjE1QzE3LjQ1IDIuMDkgMTQuOTcgMSAxMiAxIDcuNyAxIDMuOTkgMy40NyAyLjE4IDcuMDdsMy42NiAyLjg0Yy44Ny0yLjYgMy4zLTQuNTMgNi4xNi00LjUzeiIgZmlsbD0iI0VBNDMzNSIvPjxwYXRoIGQ9Ik0xIDFoMjJ2MjJIMXoiIGZpbGw9Im5vbmUiLz48L3N2Zz4="
            width={16}
          />
        )}
        Google
      </Button>
    </div>
  )
}