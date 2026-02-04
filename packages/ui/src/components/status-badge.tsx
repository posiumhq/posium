"use client"

import { cn } from "@posium/ui/lib/utils"
import { Badge } from "@posium/ui/components/badge"

export type StatusBadgeVariant = "passing" | "failed" | "flaky"

interface StatusBadgeProps {
  variant: StatusBadgeVariant
  count: number
  label: string
  className?: string
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  passing: "border-status-success/20 bg-status-success/10 text-status-success",
  failed: "border-status-error/20 bg-status-error/10 text-status-error",
  flaky: "border-status-warning/20 bg-status-warning/10 text-status-warning",
}

export function StatusBadge({ variant, count, label, className }: StatusBadgeProps) {
  return (
    <div className={cn("flex min-w-0 shrink-0 flex-row items-center gap-1.5", className)}>
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-semibold md:px-3 md:text-base",
          variantStyles[variant]
        )}
      >
        {count}
      </Badge>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

interface StatusBadgesRowProps {
  passing: number
  failed: number
  flaky: number
  className?: string
  renderBadge?: (badge: React.ReactNode, variant: StatusBadgeVariant) => React.ReactNode
}

export function StatusBadgesRow({ passing, failed, flaky, className, renderBadge }: StatusBadgesRowProps) {
  const passingBadge = <StatusBadge variant="passing" count={passing} label="Passing" />
  const failedBadge = <StatusBadge variant="failed" count={failed} label="Failed" />
  const flakyBadge = <StatusBadge variant="flaky" count={flaky} label="Flaky" />

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2 md:gap-4", className)}>
      {renderBadge ? renderBadge(passingBadge, "passing") : passingBadge}
      {renderBadge ? renderBadge(failedBadge, "failed") : failedBadge}
      {renderBadge ? renderBadge(flakyBadge, "flaky") : flakyBadge}
    </div>
  )
}
