import { cn } from "@posium/ui/lib/utils";

interface LogoProps {
  variant?: "icon" | "full";
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

export function Logo({
  variant = "full",
  className,
  iconClassName,
  textClassName,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/posium_icon_full.svg"
        alt="Posium"
        width={40}
        height={40}
        className={cn("h-10 w-10", iconClassName)}
      />
      {variant === "full" && (
        <span
          className={cn(
            "font-audiowide text-2xl font-normal tracking-wide text-foreground",
            textClassName
          )}
        >
          POSIUM
        </span>
      )}
    </div>
  );
}
