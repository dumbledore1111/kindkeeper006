export const sharedStyles = {
  input: {
    base: `w-full h-12 rounded-[2rem] border-0 
      bg-white  
      text-black text-2xl
      transition-all duration-300 px-6
      focus:outline-none focus:ring-0
      hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]`,
    active: "",
    hover: "hover:scale-[1.02] hover:brightness-105 transition-transform"
  },
  button: {
    primary: "w-full h-12 rounded-[2rem] text-xl font-medium transition-all duration-500",
    loginButton: `bg-gradient-to-r from-[#00ff00] to-[#00cc00] text-black 
      hover:from-[#00ff66] hover:to-[#00ff33]
      hover:scale-[1.02] 
      hover:shadow-[0_0_40px_rgba(0,255,0,0.6)]
      hover:animate-pulse
      active:scale-95
      transition-all duration-300`,
    signupButton: `bg-gradient-to-r from-[#ff8533] to-[#ff4d4d] text-black 
      hover:from-[#ff9966] hover:to-[#ff6666]
      hover:scale-[1.02] 
      hover:shadow-[0_0_40px_rgba(255,133,51,0.8)]
      hover:animate-pulse
      active:scale-95
      transition-all duration-300`
  }
} 