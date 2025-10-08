import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // For Netlify deployment with standalone output
  output: 'standalone',
  // Set correct workspace root to silence warning
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable static optimization for API routes to prevent build-time issues  
  experimental: {
    // staticPageGenerationTimeout removed - deprecated in Next.js 15+
  },
  // Disable static page generation for API routes
  trailingSlash: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
  // Generate unique build ID to force cache invalidation
  generateBuildId: async () => {
    // Force completely new build ID to bypass ALL caching
    return `build-${Math.random().toString(36).substring(7)}-${Date.now()}`
  },
  // Disable build-time page data collection
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Exclude Supabase functions from build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Externalize pdf-parse for server-side to avoid build issues
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pdf-parse', 'canvas');
    }

    // Exclude supabase functions directory and docs directory
    config.module.rules.push({
      test: /supabase\/functions\/.*\.ts$/,
      loader: 'ignore-loader'
    });

    config.module.rules.push({
      test: /docs\/.*\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader'
    });

    return config;
  },
}

export default nextConfig
