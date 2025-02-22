'use client'

import { AlertCircle, Clock, Filter, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

export function WorkflowSettings() {
  return (
    <div className="space-y-6">
      {/* Default View */}
      <div className="space-y-3">
        <Label className="text-white/70">Default Dashboard View</Label>
        <RadioGroup defaultValue="patients" className="grid grid-cols-2 gap-4">
          <div>
            <RadioGroupItem
              value="patients"
              id="patients"
              className="peer sr-only"
            />
            <Label
              htmlFor="patients"
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-black/40 peer-data-[state=checked]:border-cyan-500/50 peer-data-[state=checked]:bg-cyan-500/10 [&:has([data-state=checked])]:border-cyan-500/50"
            >
              <Filter className="mb-3 size-6" />
              <span className="text-sm font-medium">Patient List</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              value="timeline"
              id="timeline"
              className="peer sr-only"
            />
            <Label
              htmlFor="timeline"
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-black/40 peer-data-[state=checked]:border-cyan-500/50 peer-data-[state=checked]:bg-cyan-500/10 [&:has([data-state=checked])]:border-cyan-500/50"
            >
              <Clock className="mb-3 size-6" />
              <span className="text-sm font-medium">Timeline</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator className="bg-white/5" />

      {/* Notifications */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white/90">Workflow Notifications</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="patient-updates" className="text-white/70">
                Patient Updates
              </Label>
              <p className="text-xs text-white/50">
                Get notified when patient information is updated
              </p>
            </div>
            <Switch id="patient-updates" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ai-insights" className="text-white/70">
                AI Insights
              </Label>
              <p className="text-xs text-white/50">
                Receive notifications for new AI-generated insights
              </p>
            </div>
            <Switch id="ai-insights" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="team-messages" className="text-white/70">
                Team Messages
              </Label>
              <p className="text-xs text-white/50">
                Get notified for team communication
              </p>
            </div>
            <Switch id="team-messages" defaultChecked />
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* AI Assistant */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-cyan-400" />
          <h4 className="text-sm font-medium text-white/90">AI Assistant Preferences</h4>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-model" className="text-white/70">
              Default AI Model
            </Label>
            <Select defaultValue="o3-mini">
              <SelectTrigger
                id="ai-model"
                className="w-full border-white/10 bg-black/30 text-white/70 hover:bg-black/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              >
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="o3-mini">o3-mini (Fast)</SelectItem>
                <SelectItem value="gemini-flash">Gemini Flash (Accurate)</SelectItem>
                <SelectItem value="hybrid">Hybrid (Balanced)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="response-length" className="text-white/70">
              Response Length
            </Label>
            <Select defaultValue="balanced">
              <SelectTrigger
                id="response-length"
                className="w-full border-white/10 bg-black/30 text-white/70 hover:bg-black/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
              >
                <SelectValue placeholder="Select response length" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Save Changes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertCircle className="size-4" />
          <span className="text-sm">Changes are saved automatically</span>
        </div>
        <Button
          className="group relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
        >
          Reset to Defaults
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
} 