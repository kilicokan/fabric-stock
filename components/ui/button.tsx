import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "error" | "outline" | "ghost"
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-500 focus-visible:ring-primary-500": variant === "default",
            "bg-secondary-100 dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 hover:bg-secondary-200 dark:hover:bg-secondary-700 focus-visible:ring-secondary-500": variant === "secondary",
            "bg-success-600 text-white hover:bg-success-700 dark:hover:bg-success-500 focus-visible:ring-success-500": variant === "success",
            "bg-warning-600 text-white hover:bg-warning-700 dark:hover:bg-warning-500 focus-visible:ring-warning-500": variant === "warning",
            "bg-error-600 text-white hover:bg-error-700 dark:hover:bg-error-500 focus-visible:ring-error-500": variant === "error",
            "border border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-800 focus-visible:ring-primary-500": variant === "outline",
            "text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800 focus-visible:ring-primary-500": variant === "ghost",
          },
          {
            "h-8 px-2.5 text-xs": size === "xs",
            "h-9 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-11 px-6 text-base": size === "lg",
            "h-12 px-8 text-base": size === "xl",
          },
          className
        )}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }