/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        light: {
          background: '#ffffff',
          text: '#1a2332',
          primary: '#ff6b00',
          secondary: '#f3f4f6',
          accent: '#ff6b00',
          muted: '#9ca3af',
        },
        dark: {
          background: '#1a2332',
          text: '#ffffff',
          primary: '#ff6b00',
          secondary: '#2a3447',
          accent: '#ff6b00',
          muted: '#6b7280',
        }
      },
      keyframes: {
        'theme-fade': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'theme-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'theme-glow': {
          '0%, 100%': { 
            'box-shadow': '0 0 20px rgba(255, 107, 0, 0.5)',
            transform: 'scale(1)'
          },
          '50%': { 
            'box-shadow': '0 0 30px rgba(255, 107, 0, 0.8)',
            transform: 'scale(1.02)'
          }
        }
      },
      animation: {
        'theme-fade': 'theme-fade 0.3s ease-out',
        'theme-slide': 'theme-slide-up 0.4s ease-out',
        'theme-glow': 'theme-glow 2s infinite'
      }
    },
  },
  plugins: [],
} 