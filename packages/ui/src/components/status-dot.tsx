"use client"

import { cn } from "@posium/ui/lib/utils"
import type { StatusType } from "./status-indicators"

interface StatusDotProps {
  status: StatusType
  size?: "sm" | "md" | "lg"
  pulse?: boolean
  className?: string
}

const sizeStyles = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-3 w-3",
}

export function StatusDot({ status, size = "md", pulse = false, className }: StatusDotProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 rounded-full",
        sizeStyles[size],
        (status === "passing" || status === "passed") && "bg-status-success",
        status === "failed" && "bg-status-error",
        status === "flaky" && "bg-status-warning",
        status === "running" && "bg-chart-2",
        (status === "skipped" || status === null) && "bg-muted-foreground",
        pulse && "animate-pulse",
        className
      )}
    />
  )
}
