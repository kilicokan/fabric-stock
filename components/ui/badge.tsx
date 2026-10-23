import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "error" | "info" | "outline"
  size?: "sm" | "md"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-semibold transition-colors",
          {
            "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200": variant === "default",
            "bg-secondary-100 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200": variant === "secondary",
            "bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-200": variant === "success",
            "bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200": variant === "warning",
            "bg-error-100 dark:bg-error-900/30 text-error-800 dark:text-error-200": variant === "error",
            "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300": variant === "info",
            "border border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300": variant === "outline",
          },
          {
            "px-2 py-0.5 text-xs": size === "sm",
            "px-3 py-1 text-sm": size === "md",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }