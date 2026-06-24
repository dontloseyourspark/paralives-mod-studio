import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <--- Add this line here!
  ],
  define: {
    // Single source of truth for the app's own version — bump package.json,
    // not any hardcoded string in the UI. See src/vite-env.d.ts for the type.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
