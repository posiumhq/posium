"use client"

import { CheckCircle, XCircle } from "lucide-react"
import { cn } from "@posium/ui/lib/utils"

interface ValidationStatusProps {
  valid: boolean
  successMessage?: string
  errorMessage?: string
  className?: string
  children?: React.ReactNode
}

export function ValidationStatus({
  valid,
  successMessage = "Valid",
  errorMessage = "Invalid",
  className,
  children,
}: ValidationStatusProps) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        valid
          ? "border-status-success/20 bg-status-success/10"
          : "border-status-error/20 bg-status-error/10",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {valid ? (
          <>
            <CheckCircle className="h-4 w-4 text-status-success" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-success">{successMessage}</p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-status-error" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">{errorMessage}</p>
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  )
}

// Simpler inline status indicator
interface StatusIconProps {
  status: "passed" | "failed" | "running" | null
  className?: string
}

export function ExecutionStatusIcon({ status, className }: StatusIconProps) {
  if (status === "passed") {
    return <CheckCircle className={cn("h-4 w-4 text-status-success", className)} />
  }
  if (status === "failed") {
    return <XCircle className={cn("h-4 w-4 text-status-error", className)} />
  }
  return null
}
