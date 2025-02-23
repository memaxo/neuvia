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
            <button className="absolute bottom-0 right-0 rounded-lg border border-[#6B818C]/10 bg-[#D8E4FF]/60 p-1.5 text-[#6B818C] transition-colors duration-300 hover:text-[#050505]">
            <Camera className="size-4" />
          </button>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white/90">Profile Photo</h4>
          <p className="text-sm text-white/50">
            Upload a new photo or remove the current one
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              className="group relative overflow-hidden bg-[#D8E4FF] text-[#6B818C] hover:bg-[#D8E4FF]/80 hover:text-[#050505]"
              size="sm"
              variant="ghost"
            >
              Change Photo
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </Button>
            <Button
              className="text-[#902D41] hover:bg-[#902D41]/10 hover:text-[#902D41]/80"
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
            <Label className="text-[#6B818C]">Full Name</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#004FFF]/20 via-transparent to-[#004FFF]/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                className="border-[#6B818C]/5 bg-[#D8E4FF] pl-10 text-[#050505] placeholder:text-[#6B818C] focus:border-[#004FFF]/30 focus:ring-2 focus:ring-[#004FFF]/20"
                placeholder="Enter your full name"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
            <Label className="text-[#6B818C]">Email Address</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                placeholder="Enter your email"
                type="email"
              />
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
            <Label className="text-[#6B818C]">Phone Number</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                placeholder="Enter your phone number"
                type="tel"
              />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
            <Label className="text-[#6B818C]">Organization</Label>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative">
              <Building className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                placeholder="Enter your organization"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button className="group relative w-full overflow-hidden bg-gradient-to-r from-[#004FFF] to-[#004FFF] text-white shadow-lg transition-all duration-300 hover:from-[#004FFF]/90 hover:to-[#004FFF]/90 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          Save Changes
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
}