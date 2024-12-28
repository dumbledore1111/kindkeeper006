import { cn } from "@/lib/utils"

interface ThemeCardProps {
  children: React.ReactNode
  className?: string
  animate?: boolean
}

export function ThemeCard({ children, className, animate = false }: ThemeCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        "dark:bg-dark-secondary bg-light-secondary",
        "dark:text-dark-text text-light-text",
        "transition-all duration-300",
        animate && "animate-theme-fade",
        className
      )}
    >
      {children}
    </div>
  )
} 