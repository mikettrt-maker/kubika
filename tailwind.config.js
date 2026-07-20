/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'display': ['Outfit', 'Inter', 'sans-serif'],
        'handwriting': ['Caveat', 'cursive'],
      },
      colors: {
        'kubika': {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
          950: '#1e3a5f',
        },
        'rod': {
          white: '#FFFFFF',
          red: '#E74C3C',
          'light-green': '#2ECC71',
          pink: '#FF6B9D',
          yellow: '#F1C40F',
          'dark-green': '#27AE60',
          black: '#2C3E50',
          brown: '#8B4513',
          blue: '#3498DB',
          orange: '#E67E22',
        }
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'shimmer': 'shimmer 2s linear infinite',
        'ripple': 'ripple 0.6s linear',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scale-in': 'scaleIn 0.2s ease-out',
        'splash-logo': 'splashLogo 1.2s ease-out forwards',
        'splash-bar': 'splashBar 2s ease-in-out forwards',
        'fade-out': 'fadeOut 0.4s ease-out forwards',
        'header-slide': 'headerSlide 0.5s ease-out',
        'tooltip-in': 'tooltipIn 0.2s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.5' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(76, 110, 245, 0.3), 0 0 10px rgba(76, 110, 245, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(76, 110, 245, 0.5), 0 0 40px rgba(76, 110, 245, 0.2)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        splashLogo: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '50%': { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        splashBar: {
          '0%': { width: '0%' },
          '30%': { width: '30%' },
          '60%': { width: '65%' },
          '100%': { width: '100%' },
        },
        headerSlide: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        tooltipIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'rod': '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)',
        'rod-hover': '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
        'glass': '0 8px 32px rgba(0,0,0,0.12)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.16)',
      }
    },
  },
  plugins: [],
}
