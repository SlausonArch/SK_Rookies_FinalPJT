import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:15173', 'localhost:15174', 'localhost:55173', 'localhost:55174'],
    },
  },
}

export default nextConfig
