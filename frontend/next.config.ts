import type { NextConfig } from 'next'

const normalizeOrigin = (value: string): string => {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  try {
    return new URL(trimmed).host
  } catch {
    return trimmed.replace(/^https?:\/\//, '')
  }
}

const getAllowedOrigins = (): string[] => {
  const explicit = process.env.NEXT_SERVER_ACTION_ALLOWED_ORIGINS?.trim()

  if (explicit) {
    return explicit
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
  }

  const derived = [
    process.env.NEXT_PUBLIC_EXCHANGE_FRONTEND_URL,
    process.env.NEXT_PUBLIC_BANK_FRONTEND_URL,
    process.env.VITE_EXCHANGE_FRONTEND_URL,
    process.env.VITE_BANK_FRONTEND_URL,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeOrigin)
    .filter(Boolean)

  if (derived.length === 0) {
    throw new Error(
      'Configure NEXT_SERVER_ACTION_ALLOWED_ORIGINS or provide frontend public URLs for Next.js configuration.',
    )
  }

  return Array.from(new Set(derived))
}

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  compiler: {
    styledComponents: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
}

export default nextConfig
