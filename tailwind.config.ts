import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['selector', ':is(.dark, .abema) &'],
  // Note: .nintendo is a light theme — no dark: utilities needed
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Design token palette (CSS variable–backed) ──────────────
        lv1:    'var(--bg_lv1)',        // bg: card / surface
        lv2:    'var(--bg_lv2)',        // bg: page / subtle
        theme:  'var(--theme)',         // interactive: buttons, active, focus
        accent: 'var(--accent)',        // highlights: stats, scores, titles
        main:   'var(--main_text)',     // text: primary
        sub1:   'var(--sub_text_lv1)', // text: secondary
        sub2:   'var(--sub_text_lv2)', // text: muted
        s1:     'var(--stroke_lv1)',   // border: prominent
        s2:     'var(--stroke_lv2)',   // border: subtle

        // ── Semantic state tokens (mode-aware via CSS vars) ────────
        // Usage: bg-pos / text-pos-t  |  bg-neg / text-neg-t  |  bg-neu / text-neu-t
        pos:     'var(--pos_bg)',    // positive state background (hit, win)
        'pos-t': 'var(--pos_text)',  // positive state text
        neg:     'var(--neg_bg)',    // negative state background (out, loss)
        'neg-t': 'var(--neg_text)',  // negative state text
        neu:     'var(--neu_bg)',    // neutral state background (draw, hold)
        'neu-t': 'var(--neu_text)',  // neutral state text

        // ── Legacy palette (kept for green/field accents) ───────────
        field: {
          50:  '#f0fdf4',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
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
