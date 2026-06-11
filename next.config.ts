import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16+
  turbopack: {},
  webpack: (config) => {
    // Leaflet uses `window` — exclude from server bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  },
}

export default withNextIntl(nextConfig)
