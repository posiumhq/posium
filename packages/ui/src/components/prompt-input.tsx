"use client"

import * as React from "react"
import { cn } from "@posium/ui/lib/utils"
import { Button } from "@posium/ui/components/button"
import { Textarea } from "@posium/ui/components/textarea"
import { Loader2, Send } from "lucide-react"

export interface PromptInputMessage {
  text: string
  files?: File[]
}

interface PromptInputContextValue {
  textInput: {
    input: string
    setInput: (value: string) => void
    clear: () => void
  }
  attachments: {
    files: File[]
    add: (files: File[]) => void
    remove: (index: number) => void
    clear: () => void
  }
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null)

export const usePromptInputController = () => {
  const context = React.useContext(PromptInputContext)
  if (!context) {
    throw new Error("usePromptInputController must be used within PromptInputProvider")
  }
  return context
}

export function PromptInputProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])

  const value: PromptInputContextValue = {
    textInput: {
      input,
      setInput,
      clear: () => setInput(""),
    },
    attachments: {
      files,
      add: (newFiles) => setFiles((prev) => [...prev, ...newFiles]),
      remove: (index) => setFiles((prev) => prev.filter((_, i) => i !== index)),
      clear: () => setFiles([]),
    },
  }

  return <PromptInputContext.Provider value={value}>{children}</PromptInputContext.Provider>
}

interface PromptInputProps {
  children: React.ReactNode
  onSubmit: (message: PromptInputMessage) => void
  multiple?: boolean
  globalDrop?: boolean
  className?: string
}

export function PromptInput({ children, onSubmit, className }: PromptInputProps) {
  const controller = usePromptInputController()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const message: PromptInputMessage = {
      text: controller.textInput.input,
      files: controller.attachments.files.length > 0 ? controller.attachments.files : undefined,
    }
    onSubmit(message)
    controller.textInput.clear()
    controller.attachments.clear()
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      {children}
    </form>
  )
}

export function PromptInputBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative flex flex-col", className)}>{children}</div>
}

export function PromptInputFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2", className)}
    >
      {children}
    </div>
  )
}

export function PromptInputTools({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>
}

interface PromptInputButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
}

export function PromptInputButton({ children, className, ...props }: PromptInputButtonProps) {
  return (
    <Button type="button" variant="ghost" size="sm" className={cn("gap-2", className)} {...props}>
      {children}
    </Button>
  )
}

interface PromptInputSubmitProps {
  status?: "submitted" | "streaming" | "ready" | "error"
  className?: string
}

export function PromptInputSubmit({ status = "ready", className }: PromptInputSubmitProps) {
  const isLoading = status === "submitted" || status === "streaming"

  return (
    <Button type="submit" size="sm" disabled={isLoading} className={cn("gap-2 h-8", className)}>
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "submitted" ? "Submitting..." : "Generating..."}
        </>
      ) : (
        <>
          <Send className="h-4 w-4" />
          Generate
        </>
      )}
    </Button>
  )
}

export function PromptInputAttachments({
  children,
}: {
  children: (attachment: File) => React.ReactNode
}) {
  const controller = usePromptInputController()

  if (controller.attachments.files.length === 0) return null

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {controller.attachments.files.map((file, index) => (
        <div key={index}>{children(file)}</div>
      ))}
    </div>
  )
}

export function PromptInputAttachment({ data }: { data: File }) {
  return <div className="rounded-md bg-muted px-3 py-1 text-sm">{data.name}</div>
}

interface PromptInputTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.RefObject<HTMLTextAreaElement | null>
  className?: string
}

export function PromptInputTextarea({
  ref,
  className,
  ...props
}: PromptInputTextareaProps) {
  const controller = usePromptInputController()

  return (
    <Textarea
      ref={ref}
      value={controller.textInput.input}
      onChange={(e) => controller.textInput.setInput(e.target.value)}
      className={cn("resize-none pb-16 sm:pb-12 bg-primary-foreground", className)}
      {...props}
    />
  )
}
