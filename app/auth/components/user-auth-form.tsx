'use client'

import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthTokenResponse } from '@supabase/supabase-js'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { loginWithEmailAndPassword, signInWithGithub } from '../actions'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const LoginSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email address' }),
    password: z.string().min(1, { message: 'Password cannot be empty' }),
  })

  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof LoginSchema>) {
    startTransition(async () => {
      try {
        const { error } = JSON.parse(
          await loginWithEmailAndPassword(data)
        ) as AuthTokenResponse

        if (error) {
          toast({
            title: 'Login failed',
            description: error.message,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Login successful',
            description: 'Welcome back!',
          })
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
    <div className={cn('grid gap-6', className)} {...props}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isPending}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              disabled={isPending}
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-red-500">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button disabled={isPending} type="submit">
            {isPending ? (
              <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Sign In
          </Button>
        </div>
      </form>
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
        variant="outline"
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            try {
              await signInWithGithub()
            } catch (error) {
              toast({
                title: 'Error signing in with GitHub',
                description: 'Please try again later',
                variant: 'destructive',
              })
            }
          })
        }}
      >
        {isPending ? (
          <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.gitHub className="mr-2 h-4 w-4" />
        )}
        GitHub
      </Button>
    </div>
  )
}
