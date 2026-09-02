import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // `output: 'standalone'` was set here and broke every Vercel build from
  // 2026-08-26 on: it relies on output file tracing, a webpack feature that
  // Turbopack — the default bundler in Next 16 — does not implement. The build
  // itself succeeded; Vercel's onBuildComplete hook then died looking for
  // `.next/next-server.js.nft.json`, which Turbopack never wrote.
  //
  // Standalone output exists for self-hosting and containers. Vercel packages
  // deployments through its own Build Output API and does not need it, so the
  // option is simply removed rather than traded for a webpack build.
  turbopack: {},
  webpack: (config) => {
    // Leaflet uses `window` — exclude from server bundle
    config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    return config
  },
}

export default withNextIntl(nextConfig)
