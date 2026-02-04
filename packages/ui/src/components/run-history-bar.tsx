"use client"

import { cn } from "@posium/ui/lib/utils"

type RunStatus = "passed" | "failed" | "flaky"

interface RunHistoryBarProps {
  runs: RunStatus[]
  size?: "sm" | "md"
  className?: string
}

const sizeStyles = {
  sm: "w-2 h-4 rounded",
  md: "w-2.5 h-5 rounded-sm",
}

const statusStyles: Record<RunStatus, string> = {
  passed: "bg-status-success",
  failed: "bg-status-error",
  flaky: "bg-status-warning",
}

export function RunHistoryBar({ runs, size = "sm", className }: RunHistoryBarProps) {
  if (!runs || runs.length === 0) {
    return <span className="text-xs text-muted-foreground">No runs</span>
  }

  return (
    <div className={cn("flex gap-1", className)}>
      {runs.map((status, idx) => (
        <div
          key={idx}
          className={cn(sizeStyles[size], statusStyles[status])}
          title={status}
        />
      ))}
    </div>
  )
}
