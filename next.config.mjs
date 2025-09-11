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
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Exclude Supabase functions from build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    // Exclude supabase functions directory
    config.module.rules.push({
      test: /supabase\/functions\/.*\.ts$/,
      loader: 'ignore-loader'
    });
    
    return config;
  },
}

export default nextConfig
