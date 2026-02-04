"use client"

import { useMemo } from "react"
import { createAvatar } from "@dicebear/core"
import { rings, glass, thumbs } from "@dicebear/collection"
import { Avatar, AvatarFallback, AvatarImage } from "@posium/ui/components/avatar"
import { cn } from "@posium/ui/lib/utils"

interface DiceBearAvatarProps {
  seed: string
  type: "user" | "org" | "project"
  className?: string
  fallback?: string
}

export function DiceBearAvatar({ seed, type, className, fallback }: DiceBearAvatarProps) {
  const avatarUri = useMemo(() => {
    const styleMap = {
      user: thumbs,
      org: glass,
      project: rings,
    }

    const style = styleMap[type]
    const baseOptions = {
      seed,
      size: 128,
    }

    const options =
      type === "project"
        ? { ...baseOptions, ring: ["container"], backgroundColor: ["e5e7eb"] }
        : baseOptions

    const avatar = createAvatar(style, options)

    return avatar.toDataUri()
  }, [seed, type])

  return (
    <Avatar className={cn(className)}>
      <AvatarImage src={avatarUri || "/placeholder.svg"} alt={`${type} avatar`} />
      {fallback && (
        <AvatarFallback className="bg-accent text-foreground text-xs font-semibold">{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export function UserAvatar({ userId, fallback, className }: { userId: string; fallback?: string; className?: string }) {
  return <DiceBearAvatar seed={userId} type="user" fallback={fallback} className={className} />
}

export function OrgAvatar({ orgId, fallback, className }: { orgId: string; fallback?: string; className?: string }) {
  return <DiceBearAvatar seed={orgId} type="org" fallback={fallback} className={className} />
}

export function ProjectAvatar({
  projectId,
  fallback,
  className,
}: { projectId: string; fallback?: string; className?: string }) {
  return <DiceBearAvatar seed={projectId} type="project" fallback={fallback} className={className} />
}
