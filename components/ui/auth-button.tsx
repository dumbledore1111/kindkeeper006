import * as React from "react"
import { cn } from "@/lib/utils"

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'login' | 'signup'
}

const AuthButton = React.forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ className, variant = 'login', ...props }, ref) => {
    const baseStyles = "w-full h-12 rounded-[2rem] text-xl font-medium transition-all duration-300"
    const variantStyles = {
      login: `bg-gradient-to-r from-white to-green-400 
        hover:to-green-500
        hover:scale-[1.02] 
        hover:shadow-[0_0_40px_rgba(0,255,0,0.3)]
        hover:animate-pulse
        active:scale-95`,
      signup: `bg-gradient-to-r from-white/20 via-[#ff8533] to-[#ff4d4d] 
        hover:from-white/20 hover:via-[#ff9966] hover:to-[#ff6666]
        hover:scale-[1.02] 
        hover:shadow-[0_0_40px_rgba(255,133,51,0.8)]
        hover:animate-pulse
        active:scale-95`
    }

    return (
      <button
        className={cn(baseStyles, variantStyles[variant], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
AuthButton.displayName = "AuthButton"

export { AuthButton } 