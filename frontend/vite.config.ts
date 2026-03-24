import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROBOTS: Record<string, string> = {
  exchange: [
    'User-agent: *',
    'Disallow: /mypage',
    'Disallow: /exchange',
    'Disallow: /balances',
    'Disallow: /investments',
    'Disallow: /signup',
    'Disallow: /oauth',
    '',
  ].join('\n'),

  bank: [
    'User-agent: *',
    'Disallow: /',
    '',
  ].join('\n'),

  admin: [
    'User-agent: *',
    'Disallow: /',
    '',
  ].join('\n'),
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'robots-txt',
      configureServer(server) {
        server.middlewares.use('/robots.txt', (_req, res) => {
          const appMode = process.env.VITE_APP_MODE || 'exchange'
          const content = ROBOTS[appMode] ?? ROBOTS.exchange
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(content)
        })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: mode === 'bank' ? 15174 : 15173,
    strictPort: true,
  },
}))
