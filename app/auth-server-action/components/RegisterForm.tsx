'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { AuthTokenResponse } from '@supabase/supabase-js'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import * as z from 'zod'

import {
  signInWithGoogle,
  signUpWithEmailAndPassword,
} from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const RegisterSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address' }),
    password: z
      .string()
      .min(8, {
        message: 'Password must be at least 8 characters long',
      })
      .regex(/[0-9]/, {
        message: 'Password must contain at least one number',
      })
      .regex(/[^a-zA-Z0-9]/, {
        message: 'Password must contain at least one special character',
      })
      .regex(/[A-Z]/, {
        message: 'Password must contain at least one uppercase letter',
      })
      .regex(/[a-z]/, {
        message: 'Password must contain at least one lowercase letter',
      }),
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.password, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

const passwordRequirements = [
  { label: 'At least 8 characters long', regex: /.{8,}/ },
  { label: 'Contains at least one number', regex: /[0-9]/ },
  { label: 'Contains at least one special character', regex: /[^a-zA-Z0-9]/ },
  { label: 'Contains uppercase letter', regex: /[A-Z]/ },
  { label: 'Contains lowercase letter', regex: /[a-z]/ },
]

export default function RegisterForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const form = useForm<z.infer<typeof RegisterSchema>>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm: '',
    },
    mode: 'onChange',
  })

  const password = form.watch('password')

  function onSubmit(data: z.infer<typeof RegisterSchema>) {
    startTransition(async () => {
      const { error } = JSON.parse(
        await signUpWithEmailAndPassword(data)
      ) as AuthTokenResponse

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Registration failed',
          description: error.message,
        })
      } else {
        toast({
          title: 'Welcome to Neuvia! 🎉',
          description:
            'Your account has been created successfully. Please check your email to verify your account.',
        })
      }
    })
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true)
    await signInWithGoogle()
    setIsGoogleLoading(false)
  }

  return (
    <Form {...form}>
      <form className="w-full space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium text-foreground/70">
                Email
              </FormLabel>
              <FormControl>
                <div className="group relative">
                  <Input
                    className="border-border/50 bg-background/20 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/50 focus:ring-primary/25"
                    placeholder="email@example.com"
                    {...field}
                    type="email"
                  />
                  <div
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100"
                    style={{ padding: '1px' }}
                  />
                </div>
              </FormControl>
              <FormMessage className="animate-fade-down text-sm text-destructive" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium text-foreground/70">
                Password
              </FormLabel>
              <FormControl>
                <div className="group relative">
                  <Input
                    className="border-border/50 bg-background/20 pr-10 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/50 focus:ring-primary/25"
                    placeholder="Create a strong password"
                    type={showPassword ? 'text' : 'password'}
                    {...field}
                    onFocus={() => setShowPasswordRequirements(true)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/10 hover:text-foreground focus:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                  <div
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100"
                    style={{ padding: '1px' }}
                  />
                </div>
              </FormControl>
              <FormMessage className="animate-fade-down text-sm text-destructive" />
              {showPasswordRequirements && (
                <div className="animate-fade-down mt-2 space-y-1.5 rounded-md border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
                  {passwordRequirements.map((req, index) => (
                    <p className="flex items-center gap-2" key={index}>
                      {req.regex.test(password) ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <X className="size-3 text-destructive/70" />
                      )}
                      <span
                        className={cn(
                          req.regex.test(password)
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                        )}
                      >
                        {req.label}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-medium text-foreground/70">
                Confirm Password
              </FormLabel>
              <FormControl>
                <div className="group relative">
                  <Input
                    className="border-border/50 bg-background/20 pr-10 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/50 focus:ring-primary/25"
                    placeholder="Confirm your password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...field}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/10 hover:text-foreground focus:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    type="button"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                  <div
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100"
                    style={{ padding: '1px' }}
                  />
                </div>
              </FormControl>
              <FormMessage className="animate-fade-down text-sm text-destructive" />
            </FormItem>
          )}
        />

        <Button
          className="w-full rounded-lg bg-gradient-to-r from-primary to-primary-foreground py-5 font-medium text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:from-primary/90 hover:to-primary-foreground/90 hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:transform-none"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <div className="flex items-center justify-center gap-2">
              <AiOutlineLoading3Quarters className="animate-spin" />
              <span className="animate-pulse">Creating account...</span>
            </div>
          ) : (
            'Create Account'
          )}
        </Button>
      </form>

      <div className="mt-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <Button
          className="flex w-full items-center gap-2 border-border/50 bg-background/20 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 hover:border-border hover:bg-background/30 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isGoogleLoading}
          onClick={handleGoogleSignUp}
          type="button"
        >
          {isGoogleLoading ? (
            <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
          ) : (
            <svg
              aria-hidden="true"
              className="mr-2 size-4"
              data-icon="google"
              data-prefix="fab"
              focusable="false"
              role="img"
              viewBox="0 0 488 512"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                fill="currentColor"
              ></path>
            </svg>
          )}
          Continue with Google
        </Button>
      </div>
    </Form>
  )
}
