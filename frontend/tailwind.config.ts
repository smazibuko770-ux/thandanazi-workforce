import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { thanda: { bg: '#0a0a0a', card: '#1a1a1a', orange: '#f97316' } } } },
  plugins: [],
} satisfies Config;
