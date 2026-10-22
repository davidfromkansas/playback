import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { publicSongMoodPlugin } from './server/vite-mood.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'TYPESAFE_')
  return {
    plugins: [react(), publicSongMoodPlugin(env.TYPESAFE_API_KEY, env.TYPESAFE_CONTEXT_PILOT === 'true')],
    server: { port: 5180, strictPort: true },
  }
})
