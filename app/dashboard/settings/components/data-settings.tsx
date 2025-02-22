'use client'

import { Download, Lock, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

export function DataSettings() {
  return (
    <div className="space-y-6">
      {/* Data Privacy */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white/90">Data Privacy</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics" className="text-white/70">
                Usage Analytics
              </Label>
              <p className="text-xs text-white/50">
                Help improve our service by sharing anonymous usage data
              </p>
            </div>
            <Switch id="analytics" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="personalization" className="text-white/70">
                Personalized Experience
              </Label>
              <p className="text-xs text-white/50">
                Allow AI to learn from your interactions to improve recommendations
              </p>
            </div>
            <Switch id="personalization" defaultChecked />
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Data Management */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white/90">Data Management</h4>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Button
              variant="outline"
              className="group relative w-full justify-start space-x-2 overflow-hidden border-white/10 bg-black/30 text-white/70 hover:bg-black/40 hover:text-white"
            >
              <Download className="size-4" />
              <span>Export All Data</span>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </Button>
            <p className="text-xs text-white/50">
              Download a copy of all your data in a machine-readable format
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <Button
              variant="outline"
              className="group relative w-full justify-start space-x-2 overflow-hidden border-white/10 bg-black/30 text-white/70 hover:bg-black/40 hover:text-white"
            >
              <Upload className="size-4" />
              <span>Import Data</span>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </Button>
            <p className="text-xs text-white/50">
              Import data from another service or backup
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <Button
              variant="outline"
              className="group relative w-full justify-start space-x-2 overflow-hidden border-white/10 bg-black/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="size-4" />
              <span>Delete All Data</span>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
              </div>
            </Button>
            <p className="text-xs text-white/50">
              Permanently delete all your data from our servers
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Data Encryption */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-cyan-400" />
          <h4 className="text-sm font-medium text-white/90">End-to-End Encryption</h4>
        </div>
        <p className="text-sm text-white/70">
          Your data is encrypted using industry-standard protocols. Only you can access your sensitive information.
        </p>
        <Button
          className="group relative w-full overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
        >
          Manage Encryption Settings
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
} 