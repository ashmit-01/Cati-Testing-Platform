/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B1120',
        card: '#111827',
        border: '#1F2937',
        primary: '#F9FAFB',
        secondary: '#94A3B8',
        success: '#22C55E',
        failure: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      }
    }
  },
  plugins: []
}
