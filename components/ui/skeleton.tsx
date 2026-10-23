import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number
  type?: "text" | "avatar" | "rect" | "circle"
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, count = 1, type = "text", ...props }, ref) => {
    const getClassName = () => {
      switch (type) {
        case "avatar":
          return "rounded-full w-12 h-12"
        case "circle":
          return "rounded-full w-10 h-10"
        case "rect":
          return "rounded-lg w-full h-32"
        case "text":
        default:
          return "rounded h-4 w-full"
      }
    }

    const skeletons = Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        ref={i === 0 ? ref : undefined}
        className={cn(
          "bg-secondary-200 dark:bg-secondary-700 animate-pulse",
          getClassName(),
          i < count - 1 ? "mb-3" : "",
          className
        )}
        {...props}
      />
    ))

    return count === 1 ? skeletons[0] : <div className="space-y-3">{skeletons}</div>
  }
)
Skeleton.displayName = "Skeleton"

export { Skeleton }
