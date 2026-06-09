import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16+
  turbopack: {},
  webpack: (config) => {
    // Leaflet uses `window` — exclude from server bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  },
}

export default nextConfig
