'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthTokenResponse } from '@supabase/supabase-js'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import * as z from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { loginWithEmailAndPassword } from '@/app/auth/actions'

const SignInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(1, { message: 'Password cannot be empty' }),
})

export default function SignInForm() {
  const [isPending, startTransition] = useTransition()
  const form = useForm<z.infer<typeof SignInSchema>>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSignInSubmit = async (data: z.infer<typeof SignInSchema>) => {
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
    <Form {...form}>
      <form
        className="w-full space-y-6"
        onSubmit={form.handleSubmit(onSignInSubmit)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="example@gmail.com"
                  type="email"
                  disabled={isPending}
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
                <Input
                  placeholder="Enter your password"
                  type="password"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          className="flex w-full items-center gap-2"
          variant="outline"
          type="submit"
          disabled={isPending}
        >
          {isPending ? 'Signing in...' : 'Sign In'}{' '}
          <AiOutlineLoading3Quarters
            className={cn('animate-spin', { hidden: !isPending })}
          />
        </Button>
      </form>
    </Form>
  )
}
