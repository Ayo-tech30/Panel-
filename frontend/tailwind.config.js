/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a24',
          600: '#24242f',
          500: '#2e2e3a',
          400: '#3a3a48',
        },
        accent: {
          DEFAULT: '#25d366',
          dark: '#128c5e',
          glow: '#25d36633',
        },
        danger: '#ef4444',
        warn: '#f59e0b',
      },
      boxShadow: {
        'accent-glow': '0 0 20px #25d36633',
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
