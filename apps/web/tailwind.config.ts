import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background:           'hsl(var(--background))',
        surface:              'hsl(var(--surface))',
        'surface-elevated':   'hsl(var(--surface-elevated))',
        border:               'hsl(var(--border))',
        'border-strong':      'hsl(var(--border-strong))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          hover:      'hsl(var(--primary-hover))',
          active:     'hsl(var(--primary-active))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger:  'hsl(var(--danger))',
        info:    'hsl(var(--info))',
        'text-primary':   'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-muted':     'hsl(var(--text-muted))',
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':  'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(4px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
export default config
