import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Tailwind className birleştirme helper
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}
