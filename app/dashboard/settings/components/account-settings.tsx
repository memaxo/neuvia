'use client'

import { Building, Camera, Mail, Phone, User } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountSettings() {
  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="flex items-center gap-6">
        <div className="group relative">
          <div className="relative size-20 overflow-hidden rounded-full">
            <Image
              alt="Profile picture"
              className="size-full object-cover"
              height={80}
              src="/placeholder.jpg"
              width={80}
            />
          </div>
          <button className="absolute bottom-0 right-0 rounded-lg border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] p-1.5 text-[rgb(var(--foreground))/var(--opacity-70)] transition-colors duration-300 hover:text-[rgb(var(--foreground))]">
            <Camera className="size-4" />
          </button>
        </div>
        <div>
          <h4 className="text-sm font-medium text-[rgb(var(--foreground))]">
            Profile Photo
          </h4>
          <p className="text-sm text-[rgb(var(--foreground))/var(--opacity-50)]">
            Upload a new photo or remove the current one
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              className="group relative overflow-hidden bg-[rgb(var(--primary))/var(--opacity-10)] text-[rgb(var(--primary))] hover:bg-[rgb(var(--primary))/var(--opacity-20)]"
              size="sm"
              variant="ghost"
            >
              Change Photo
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))/var(--opacity-40)] to-transparent" />
              </div>
            </Button>
            <Button
              className="text-[rgb(var(--destructive))] hover:bg-[rgb(var(--destructive))/var(--opacity-10)] hover:text-[rgb(var(--destructive))/var(--opacity-80)]"
              size="sm"
              variant="ghost"
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label className="text-[rgb(var(--foreground))/var(--opacity-70)]">
            Full Name
          </Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] via-transparent to-[rgb(var(--primary))/var(--opacity-20)] opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--foreground))/var(--opacity-40)] transition-colors duration-300 group-focus-within:text-[rgb(var(--primary))]" />
              <Input
                className="border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] pl-10 text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground))/var(--opacity-40)] focus:border-[rgb(var(--primary))/var(--opacity-30)] focus:ring-2 focus:ring-[rgb(var(--primary))/var(--opacity-20)]"
                placeholder="Enter your full name"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-[rgb(var(--foreground))/var(--opacity-70)]">
            Email Address
          </Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] via-transparent to-[rgb(var(--primary))/var(--opacity-20)] opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--foreground))/var(--opacity-40)] transition-colors duration-300 group-focus-within:text-[rgb(var(--primary))]" />
              <Input
                className="border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] pl-10 text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground))/var(--opacity-40)] focus:border-[rgb(var(--primary))/var(--opacity-30)] focus:ring-2 focus:ring-[rgb(var(--primary))/var(--opacity-20)]"
                placeholder="Enter your email"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label className="text-[rgb(var(--foreground))/var(--opacity-70)]">
            Phone Number
          </Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] via-transparent to-[rgb(var(--primary))/var(--opacity-20)] opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--foreground))/var(--opacity-40)] transition-colors duration-300 group-focus-within:text-[rgb(var(--primary))]" />
              <Input
                className="border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] pl-10 text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground))/var(--opacity-40)] focus:border-[rgb(var(--primary))/var(--opacity-30)] focus:ring-2 focus:ring-[rgb(var(--primary))/var(--opacity-20)]"
                placeholder="Enter your phone number"
                type="tel"
              />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
          <Label className="text-[rgb(var(--foreground))/var(--opacity-70)]">
            Organization
          </Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[rgb(var(--primary))/var(--opacity-20)] via-transparent to-[rgb(var(--primary))/var(--opacity-20)] opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Building className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--foreground))/var(--opacity-40)] transition-colors duration-300 group-focus-within:text-[rgb(var(--primary))]" />
              <Input
                className="border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] pl-10 text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground))/var(--opacity-40)] focus:border-[rgb(var(--primary))/var(--opacity-30)] focus:ring-2 focus:ring-[rgb(var(--primary))/var(--opacity-20)]"
                placeholder="Enter your organization"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button className="group relative w-full overflow-hidden bg-[rgb(var(--primary))] text-white shadow-lg transition-all duration-300 hover:bg-[rgb(var(--primary))/var(--opacity-90)] hover:shadow-[0_0_30px_rgba(var(--primary),0.3)]">
          Save Changes
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
}
