import { FlaskConical, Play, Check, X, Minus, Layers } from "lucide-react"
import { cn } from "@posium/ui/lib/utils"

export type StatusType = "passing" | "passed" | "failed" | "flaky" | "skipped" | "running" | null

interface StatusIndicatorProps {
  status: StatusType
  className?: string
}

// Test indicator - uses FlaskConical icon
export function TestIndicator({ status, className }: StatusIndicatorProps) {
  return (
    <FlaskConical
      className={cn(
        "h-4 w-4",
        (status === "passing" || status === "passed") && "text-status-success",
        status === "failed" && "text-status-error",
        status === "flaky" && "text-status-warning",
        (status === "skipped" || status === null) && "text-muted-foreground",
        status === "running" && "text-chart-2 animate-pulse",
        className,
      )}
    />
  )
}

// Run indicator - uses Play icon
export function RunIndicator({ status, className }: StatusIndicatorProps) {
  return (
    <Play
      className={cn(
        "h-4 w-4",
        (status === "passing" || status === "passed") && "text-status-success fill-status-success",
        status === "failed" && "text-status-error fill-status-error",
        status === "flaky" && "text-status-warning fill-status-warning",
        (status === "skipped" || status === null) && "text-muted-foreground",
        status === "running" && "text-chart-2 animate-pulse",
        className,
      )}
    />
  )
}

// Suite indicator - uses Layers (stack) icon
export function SuiteIndicator({ status, className }: StatusIndicatorProps) {
  return (
    <Layers
      className={cn(
        "h-4 w-4",
        (status === "passing" || status === "passed") && "text-status-success",
        status === "failed" && "text-status-error",
        status === "flaky" && "text-status-warning",
        (status === "skipped" || status === null) && "text-muted-foreground",
        status === "running" && "text-chart-2 animate-pulse",
        className,
      )}
    />
  )
}

// Step indicator - uses Check/X/Minus icons based on status
export function StepIndicator({ status, className }: StatusIndicatorProps) {
  if (status === "passing" || status === "passed") {
    return <Check className={cn("h-4 w-4 text-status-success", className)} />
  }

  if (status === "failed") {
    return <X className={cn("h-4 w-4 text-status-error", className)} />
  }

  if (status === "skipped" || status === null) {
    return <Minus className={cn("h-4 w-4 text-muted-foreground", className)} />
  }

  if (status === "running") {
    return <Check className={cn("h-4 w-4 text-chart-2 animate-pulse", className)} />
  }

  // Running state
  return <Check className={cn("h-4 w-4 text-chart-2 animate-pulse", className)} />
}

// Helper function to get status badge with icon
export function getStatusBadgeProps(status: StatusType) {
  switch (status) {
    case "passing":
    case "passed":
      return {
        className: "bg-status-success/10 text-status-success border-status-success/20",
        icon: Check,
      }
    case "failed":
      return {
        className: "bg-status-error/10 text-status-error border-status-error/20",
        icon: X,
      }
    case "flaky":
      return {
        className: "bg-status-warning/10 text-status-warning border-status-warning/20",
        icon: Minus,
      }
    case "running":
      return {
        className: "bg-chart-2/10 text-chart-2 border-chart-2/20",
        icon: Play,
      }
    default:
      return {
        className: "bg-muted text-muted-foreground border-border",
        icon: Minus,
      }
  }
}
