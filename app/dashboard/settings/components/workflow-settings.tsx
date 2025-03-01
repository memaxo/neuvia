'use client'

import { AlertCircle, Clock, Filter, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export function WorkflowSettings() {
  return (
    <div className="space-y-6">
      {/* Default View */}
      <div className="space-y-3">
        <Label className="text-[#6B818C]">Default Dashboard View</Label>
        <RadioGroup className="grid grid-cols-2 gap-4" defaultValue="patients">
          <div>
            <RadioGroupItem
              className="peer sr-only"
              id="patients"
              value="patients"
            />
            <Label
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-[#6B818C]/10 bg-[#D8E4FF] p-4 hover:bg-[#D8E4FF]/80 peer-data-[state=checked]:border-[#004FFF]/50 peer-data-[state=checked]:bg-[#004FFF]/10 [&:has([data-state=checked])]:border-[#004FFF]/50"
              htmlFor="patients"
            >
              <Filter className="mb-3 size-6" />
              <span className="text-sm font-medium">Patient List</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              className="peer sr-only"
              id="timeline"
              value="timeline"
            />
            <Label
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-black/40 peer-data-[state=checked]:border-cyan-500/50 peer-data-[state=checked]:bg-cyan-500/10 [&:has([data-state=checked])]:border-cyan-500/50"
              htmlFor="timeline"
            >
              <Clock className="mb-3 size-6" />
              <span className="text-sm font-medium">Timeline</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator className="bg-[#6B818C]/5" />

      {/* Notifications */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white/90">
          Workflow Notifications
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white/70" htmlFor="patient-updates">
                Patient Updates
              </Label>
              <p className="text-xs text-white/50">
                Get notified when patient information is updated
              </p>
            </div>
            <Switch defaultChecked id="patient-updates" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white/70" htmlFor="ai-insights">
                AI Insights
              </Label>
              <p className="text-xs text-white/50">
                Receive notifications for new AI-generated insights
              </p>
            </div>
            <Switch defaultChecked id="ai-insights" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white/70" htmlFor="team-messages">
                Team Messages
              </Label>
              <p className="text-xs text-white/50">
                Get notified for team communication
              </p>
            </div>
            <Switch defaultChecked id="team-messages" />
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* AI Assistant */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-cyan-400" />
          <h4 className="text-sm font-medium text-white/90">
            AI Assistant Preferences
          </h4>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/70" htmlFor="ai-model">
              Default AI Model
            </Label>
            <Select defaultValue="o3-mini">
              <SelectTrigger
                className="w-full border-white/10 bg-black/30 text-white/70 hover:bg-black/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                id="ai-model"
              >
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="o3-mini">o3-mini (Fast)</SelectItem>
                <SelectItem value="gemini-flash">
                  Gemini Flash (Accurate)
                </SelectItem>
                <SelectItem value="hybrid">Hybrid (Balanced)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-white/70" htmlFor="response-length">
              Response Length
            </Label>
            <Select defaultValue="balanced">
              <SelectTrigger
                className="w-full border-white/10 bg-black/30 text-white/70 hover:bg-black/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                id="response-length"
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
        <Button className="group relative overflow-hidden bg-gradient-to-r from-[#004FFF] to-[#004FFF] text-white shadow-lg transition-all duration-300 hover:from-[#004FFF]/90 hover:to-[#004FFF]/90 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          Reset to Defaults
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
}
