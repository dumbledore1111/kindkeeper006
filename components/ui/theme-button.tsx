import { cn } from "@/lib/utils"
import { ButtonHTMLAttributes, forwardRef } from "react"

interface ThemeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const ThemeButton = forwardRef<HTMLButtonElement, ThemeButtonProps>(
  ({ className, variant = 'default', size = 'md', isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "rounded-md font-medium transition-all duration-200",
          // Size variants
          size === 'sm' && "px-3 py-1.5 text-sm",
          size === 'md' && "px-4 py-2 text-base",
          size === 'lg' && "px-6 py-3 text-lg",
          // Theme & variant combinations
          variant === 'default' && "dark:bg-dark-primary bg-light-primary text-white hover:opacity-90",
          variant === 'outline' && "border-2 dark:border-dark-primary dark:text-dark-primary border-light-primary text-light-primary hover:bg-light-primary/10 dark:hover:bg-dark-primary/10",
          variant === 'ghost' && "dark:text-dark-text text-light-text hover:bg-light-secondary/50 dark:hover:bg-dark-secondary/50",
          // Loading state
          isLoading && "opacity-50 cursor-not-allowed",
          // Custom classes
          className
        )}
        disabled={isLoading}
        {...props}
      >
        {children}
      </button>
    )
  }
)

ThemeButton.displayName = "ThemeButton"

export { ThemeButton } 