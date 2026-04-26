import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Vite’s default env dir is ``frontend/``. Many devs keep ``.env.local`` at the repo root
 * (e.g. Vercel CLI). If a root ``.env`` / ``.env.local`` exists, load env from there so
 * ``VITE_SUPABASE_*`` is visible to the client.
 */
function resolveEnvDir(): string {
  const root = path.resolve(__dirname, '..')
  const hasRootEnv =
    fs.existsSync(path.join(root, '.env.local')) || fs.existsSync(path.join(root, '.env'))
  return hasRootEnv ? root : __dirname
}

// https://vite.dev/config/
export default defineConfig({
  envDir: resolveEnvDir(),
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
