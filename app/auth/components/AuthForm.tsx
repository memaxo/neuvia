'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthTokenResponse } from '@supabase/supabase-js'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import * as z from 'zod'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { loginWithEmailAndPassword, signInWithGoogle } from '../actions'

const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password cannot be empty' }),
  rememberMe: z.boolean().default(false).optional(),
})

const passwordRequirements = [
  'At least 8 characters long',
  'Contains at least one number',
  'Contains at least one special character',
  'Contains uppercase and lowercase letters',
]

export default function AuthForm() {
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  function onSubmit(data: z.infer<typeof LoginSchema>) {
    startTransition(async () => {
      const { error } = JSON.parse(
        await loginWithEmailAndPassword(data)
      ) as AuthTokenResponse

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: error.message,
        })
      } else {
        toast({
          title: 'Welcome back! 🎉',
          description: 'Successfully logged in to your account.',
        })
      }
    })
  }

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-4"
        >
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
                      placeholder="email@example.com"
                      className="border-border/50 bg-background/20 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/50 focus:ring-primary/25"
                      {...field}
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
                      placeholder="Enter your password"
                      type={showPassword ? 'text' : 'password'}
                      className="border-border/50 bg-background/20 pr-10 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/50 focus:ring-primary/25"
                      {...field}
                      onFocus={() => setShowPasswordRequirements(true)}
                      onBlur={() => setShowPasswordRequirements(false)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/10 hover:text-foreground focus:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="animate-fade-down text-sm text-destructive" />
                {showPasswordRequirements && (
                  <div className="animate-fade-down mt-2 space-y-1.5 rounded-md border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
                    {passwordRequirements.map((req, index) => (
                      <p key={index} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground/30"></span>
                        {req}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      /* Implement forgot password */
                    }}
                    className="rounded-md px-2 py-1 text-sm text-primary/90 transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    Forgot password?
                  </button>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-border/50 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Remember me
                </FormLabel>
              </FormItem>
            )}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card/30 px-2 text-muted-foreground backdrop-blur-sm">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isGoogleLoading}
            onClick={() => {
              setIsGoogleLoading(true)
              signInWithGoogle()
            }}
            className="w-full border-border/50 bg-background/20 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] transition-all duration-200 hover:border-border hover:bg-background/30 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGoogleLoading ? (
              <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg
                className="mr-2 h-4 w-4"
                aria-hidden="true"
                focusable="false"
                data-prefix="fab"
                data-icon="google"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                ></path>
              </svg>
            )}
            Continue with Google
          </Button>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full transform rounded-lg bg-gradient-to-r from-primary to-primary-foreground py-5 font-medium text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:from-primary/90 hover:to-primary-foreground/90 hover:shadow-[0_0_20px_rgba(var(--primary),0.3)] focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:transform-none"
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <AiOutlineLoading3Quarters className="animate-spin" />
                <span className="animate-pulse">Signing in...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
