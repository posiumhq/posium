"use client";

import * as React from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@posium/ui/lib/utils";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@posium/ui/components/toggle-group";

interface ThemeToggleProps {
  className?: string;
  onThemeChange?: (theme: "system" | "light" | "dark") => void;
}

const themes = [
  { value: "system", icon: Monitor, label: "System theme" },
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
] as const;

type ThemeValue = "system" | "light" | "dark";

function ThemeToggle({ className, onThemeChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (value: string) => {
    if (!value) return; // Prevent deselection
    const themeValue = value as ThemeValue;
    setTheme(themeValue);
    onThemeChange?.(themeValue);
  };

  if (!mounted) {
    return (
      <div className={cn("flex items-center justify-between", className)}>
        <span className="text-sm">Theme</span>
        <div className="bg-muted h-8 w-[96px] animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-sm">Theme</span>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={handleThemeChange}
        size="sm"
      >
        {themes.map(({ value, icon: Icon, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={label}
            className="h-7 w-7 px-0"
          >
            <Icon className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export { ThemeToggle };
export type { ThemeToggleProps };
