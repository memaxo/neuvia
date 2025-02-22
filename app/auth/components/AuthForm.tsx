'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState, useTransition } from 'react'
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

  const handleAuthResponse = ({ data, error }: AuthResponse) => {
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

  const onSubmit = async (formData: LoginFormData) => {
    startTransition(async () => {
      try {
        const response = await loginWithEmailAndPassword(formData)
        handleAuthResponse(response)
      } catch (error) {
        toast({
          title: 'An error occurred',
          description: 'Please try again later',
          variant: 'destructive',
        })
      }
    })
  }

  const handleGoogleSignIn = async () => {
    startTransition(async () => {
      try {
        const response = await signInWithGoogle()
        if (response.data?.url) {
          window.location.href = response.url
        } else {
          handleAuthResponse(response)
        }
      } catch (error) {
        toast({
          title: 'An error occurred',
          description: 'Please try again later',
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isPending}
                    placeholder="name@example.com"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
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
                      onClick={() => setShowPassword(!showPassword)}
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
            )}
          />
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
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
            )}
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
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button
        disabled={isPending}
        onClick={handleGoogleSignIn}
        type="button"
        variant="outline"
      >
        {isPending ? (
          <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
        ) : (
          <svg
            aria-hidden="true"
            className="mr-2 size-4"
            data-icon="github"
            data-prefix="fab"
            focusable="false"
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
        )}
        Google
      </Button>
    </div>
  )
}
