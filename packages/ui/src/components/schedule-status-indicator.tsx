"use client"

import { Play, Pause } from "lucide-react"
import { cn } from "@posium/ui/lib/utils"

interface ScheduleStatusIndicatorProps {
  enabled: boolean
  className?: string
}

export function ScheduleStatusIndicator({ enabled, className }: ScheduleStatusIndicatorProps) {
  if (enabled) {
    return (
      <Play
        className={cn("h-4 w-4 text-status-success fill-status-success", className)}
      />
    )
  }

  return (
    <Pause
      className={cn("h-4 w-4 text-muted-foreground", className)}
    />
  )
}
