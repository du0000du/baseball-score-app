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
        // Baseball Crimson
        crimson: {
          50:  '#fff1f0',
          100: '#ffe0da',
          200: '#ffc5bc',
          300: '#f4907e',
          400: '#e05252',
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
        // Dark mode — deep red-black (baseball dark theme)
        night: {
          950: '#0b0808',   // main bg (very dark red-black)
          900: '#120d0d',   // sidebar / secondary bg
          800: '#1c1414',   // cards / surfaces
          750: '#231b1b',   // table header, row hover
          700: '#2c2020',   // elevated surfaces
          600: '#3d2828',   // borders / dividers
          500: '#523535',   // subtle borders
          400: '#a08888',   // secondary text (warm muted)
          300: '#c4b0b0',   // muted text
          200: '#e0d0d0',   // subdued text
          100: '#f2eaea',   // near-white warm text
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
