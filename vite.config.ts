import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const devBackendUrl = env.VITE_DEV_BACKEND_URL || 'http://localhost:3001'
  const hmrHost = env.VITE_HMR_HOST
  const hmrProtocol = env.VITE_HMR_PROTOCOL as 'ws' | 'wss' | undefined
  const hmrClientPort = env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : undefined

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['discord.slovenitech.si'],
      proxy: {
        '/api': {
          target: devBackendUrl,
          changeOrigin: true,
        },
        '/upload': {
          target: devBackendUrl,
          changeOrigin: true,
        },
        '/images': {
          target: devBackendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: devBackendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
      ...(hmrHost || hmrProtocol || hmrClientPort
        ? {
          hmr: {
            ...(hmrHost ? { host: hmrHost } : {}),
            ...(hmrProtocol ? { protocol: hmrProtocol } : {}),
            ...(hmrClientPort ? { clientPort: hmrClientPort } : {}),
          },
        }
        : {}),
    },
  }
})
