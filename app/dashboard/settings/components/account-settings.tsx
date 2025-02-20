"use client"

import { User, Mail, Phone, Building, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function AccountSettings() {
  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 p-1">
            <div className="w-full h-full rounded-xl bg-black/40 overflow-hidden">
              <img
                src="https://avatars.githubusercontent.com/u/1234567?v=4"
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <button className="absolute bottom-0 right-0 p-1.5 rounded-lg bg-black/60 border border-white/10 text-white/70 hover:text-white transition-colors duration-300">
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white/90">Profile Photo</h4>
          <p className="text-sm text-white/50">
            Upload a new photo or remove the current one
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative overflow-hidden group bg-black/40 hover:bg-black/60 text-white/70 hover:text-white"
            >
              Change Photo
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent group-hover:animate-scan" />
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
              <Input
                placeholder="Enter your full name"
                className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                         focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-white/70">Email Address</Label>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
              <Input
                type="email"
                placeholder="Enter your email"
                className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                         focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
              />
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label className="text-white/70">Phone Number</Label>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
              <Input
                type="tel"
                placeholder="Enter your phone number"
                className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                         focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
              />
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="space-y-2">
          <Label className="text-white/70">Organization</Label>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
              <Input
                placeholder="Enter your organization"
                className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                         focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button
          className="relative overflow-hidden group w-full bg-gradient-to-r from-cyan-500 to-blue-500 
                   hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg
                   hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300"
        >
          Save Changes
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:animate-scan" />
          </div>
        </Button>
      </div>
    </div>
  )
} 