import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Baseball Crimson — Cardinals/Red Sox 系のクラシックな深紅
        // Canva "Cardinal & Cream" / "Crimson & Charcoal" コンセプト準拠
        crimson: {
          50:  '#fff1f0',   // 極薄ローズ（ホバー背景）
          100: '#ffe0da',   // 薄ピンク（選択状態）
          200: '#ffc5bc',   // ライトローズ
          300: '#f4907e',   // サーモンピンク（ホバーボーダー）
          500: '#b83227',   // メインクリムゾン（Cardinals/Red Sox 系）
          600: '#9d2a1e',   // ホバー
          700: '#7f2117',   // ダーククリムゾン（ナビ背景・見出し）
          800: '#641810',   // ディープ（ログイン背景）
          900: '#4a1009',   // 最暗
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
