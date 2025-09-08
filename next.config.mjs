/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // For Netlify deployment - removed standalone as it's handled by plugin
  outputFileTracingRoot: '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7',
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig