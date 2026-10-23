import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-secondary-500 dark:placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary-900 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 transition-colors",
            error
              ? "border-error-300 dark:border-error-700 focus-visible:ring-error-500"
              : "border-secondary-300 dark:border-secondary-600 focus-visible:ring-primary-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-error-600 dark:text-error-400 mt-1">{error}</p>}
        {helperText && !error && <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">{helperText}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }