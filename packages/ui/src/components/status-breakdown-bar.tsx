"use client"

import { cn } from "@posium/ui/lib/utils"

export interface StatusBreakdownData {
  passing: number
  failed: number
  flaky: number
  passingPercent: number
  failedPercent: number
  flakyPercent: number
}

interface StatusBreakdownBarProps {
  data: StatusBreakdownData
  className?: string
}

export function StatusBreakdownBar({ data, className }: StatusBreakdownBarProps) {
  const hasPassing = data.passingPercent > 0
  const hasFailed = data.failedPercent > 0
  const hasFlaky = data.flakyPercent > 0
  const hasAnySegment = hasPassing || hasFailed || hasFlaky

  // Calculate "no status" percentage (tests without pass/fail/flaky status)
  const noStatusPercent = Math.max(0, 100 - data.passingPercent - data.failedPercent - data.flakyPercent)
  const hasNoStatus = noStatusPercent > 0.5 // Use threshold to avoid floating point issues

  // Determine which segment is first and last for proper rounding
  const isPassingFirst = hasPassing
  const isPassingLast = hasPassing && !hasFailed && !hasFlaky && !hasNoStatus

  const isFailedFirst = !hasPassing && hasFailed
  const isFailedLast = hasFailed && !hasFlaky && !hasNoStatus

  const isFlakyFirst = !hasPassing && !hasFailed && hasFlaky
  const isFlakyLast = hasFlaky && !hasNoStatus

  const isNoStatusFirst = !hasPassing && !hasFailed && !hasFlaky && hasNoStatus
  const isNoStatusLast = hasNoStatus

  // Empty state - show muted background when no data
  if (!hasAnySegment && !hasNoStatus) {
    return <div className={cn("h-2 w-full rounded-full bg-muted", className)} />
  }

  return (
    <div className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {hasPassing && (
        <div
          className={cn(
            "bg-status-success transition-all",
            isPassingFirst && "rounded-l-full",
            isPassingLast && "rounded-r-full"
          )}
          style={{ width: `${data.passingPercent}%` }}
        />
      )}
      {hasFailed && (
        <div
          className={cn(
            "bg-status-error transition-all",
            isFailedFirst && "rounded-l-full",
            isFailedLast && "rounded-r-full"
          )}
          style={{ width: `${data.failedPercent}%` }}
        />
      )}
      {hasFlaky && (
        <div
          className={cn(
            "bg-status-warning transition-all",
            isFlakyFirst && "rounded-l-full",
            isFlakyLast && "rounded-r-full"
          )}
          style={{ width: `${data.flakyPercent}%` }}
        />
      )}
      {hasNoStatus && (
        <div
          className={cn(
            "bg-muted transition-all",
            isNoStatusFirst && "rounded-l-full",
            isNoStatusLast && "rounded-r-full"
          )}
          style={{ width: `${noStatusPercent}%` }}
        />
      )}
    </div>
  )
}
