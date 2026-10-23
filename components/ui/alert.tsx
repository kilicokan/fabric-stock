import * as React from "react"
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "info" | "warning" | "error"
  onClose?: () => void
  title?: string
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", onClose, title, children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-50 border-secondary-200 dark:border-secondary-700",
      success: "bg-success-50 dark:bg-success-900/20 text-success-900 dark:text-success-200 border-success-200 dark:border-success-800",
      info: "bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-200 border-primary-200 dark:border-primary-800",
      warning: "bg-warning-50 dark:bg-warning-900/20 text-warning-900 dark:text-warning-200 border-warning-200 dark:border-warning-800",
      error: "bg-error-50 dark:bg-error-900/20 text-error-900 dark:text-error-200 border-error-200 dark:border-error-800",
    }

    const iconMap = {
      default: AlertCircle,
      success: CheckCircle,
      info: Info,
      warning: AlertTriangle,
      error: AlertCircle,
    }

    const Icon = iconMap[variant]

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-lg border p-4 flex gap-3",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {title && <h5 className="font-semibold mb-1">{title}</h5>}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
            aria-label="Close alert"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = "Alert"

export { Alert }
