'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AuthTokenResponse } from '@supabase/supabase-js'
import { useState } from 'react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { z } from 'zod'

import { Icons } from '@/components/icons'
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
import { cn } from '@/lib/utils'

import { loginWithEmailAndPassword, signInWithGithub, signUpWithEmailAndPassword } from '../actions'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirm: z.string()
}).refine((data) => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"]
})

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirm: ''
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const result = await signUpWithEmailAndPassword(values)
      const parsed = JSON.parse(result)
      
      if (parsed.error) {
        toast({
          title: 'Error',
          description: parsed.error.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Check your email to confirm your account',
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <>
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        disabled={isLoading}
                        id="email"
                        placeholder="name@example.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </>
                )}
              />
            </div>
            <div className="grid gap-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <>
                    <FormLabel htmlFor="password">Password</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        id="password"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </>
                )}
              />
            </div>
            <div className="grid gap-2">
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <>
                    <FormLabel htmlFor="confirm">Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        id="confirm"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </>
                )}
              />
            </div>
            <Button disabled={isLoading} type="submit">
              {isLoading ? (
                <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
              ) : null}
              Sign Up
            </Button>
          </div>
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
        disabled={isLoading}
        onClick={() => {
          setIsLoading(true)
          try {
            signInWithGithub()
          } catch (error) {
            toast({
              title: 'Error signing in with GitHub',
              description: 'Please try again later',
              variant: 'destructive',
            })
          } finally {
            setIsLoading(false)
          }
        }}
        type="button"
        variant="outline"
      >
        {isLoading ? (
          <AiOutlineLoading3Quarters className="mr-2 size-4 animate-spin" />
        ) : (
          <Icons.gitHub className="mr-2 size-4" />
        )}
        GitHub
      </Button>
    </div>
  )
}
