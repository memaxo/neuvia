'use client'

import Image from 'next/image'
import { Building, Camera, Mail, Phone, User } from 'lucide-react'
import { _cn as cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AccountSettings() {
  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="flex items-center gap-6">
        <div className="group relative">
          <div className="relative h-20 w-20 overflow-hidden rounded-full">
            <Image
              src="/placeholder.jpg"
              alt="Profile picture"
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          </div>
          <button className="absolute bottom-0 right-0 rounded-lg border border-white/10 bg-black/60 p-1.5 text-white/70 transition-colors duration-300 hover:text-white">
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white/90">Profile Photo</h4>
          <p className="text-sm text-white/50">
            Upload a new photo or remove the current one
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="group relative overflow-hidden bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
            >
              Change Photo
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
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
          <Label className="text-white/70">Full Name</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                placeholder="Enter your full name"
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-white/70">Email Address</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                type="email"
                placeholder="Enter your email"
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label className="text-white/70">Phone Number</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                type="tel"
                placeholder="Enter your phone number"
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
          <Label className="text-white/70">Organization</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                placeholder="Enter your organization"
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button className="group relative w-full overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]">
          Save Changes
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
}
