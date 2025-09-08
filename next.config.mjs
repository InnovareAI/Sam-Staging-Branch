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
}

export default nextConfig