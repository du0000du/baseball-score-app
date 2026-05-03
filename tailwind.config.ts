import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        crimson: {
          50:  '#fff1f0',
          100: '#ffe0da',
          200: '#ffc5bc',
          300: '#f4907e',
          500: '#b83227',
          600: '#9d2a1e',
          700: '#7f2117',
          800: '#641810',
          900: '#4a1009',
        },
        field: {
          50: '#f0fdf4',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.18s ease-out both',
        'fade-in': 'fadeIn 0.15s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
