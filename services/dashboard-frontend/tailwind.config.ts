// tailwind.config.ts
/** @type {import('tailwindcss').Config} */
import type { Config } from 'tailwindcss'

export default {
  // No `content` array is needed anymore with the Vite plugin!
  
  plugins: [
    require('@tailwindcss/typography')
  ],
} satisfies Config