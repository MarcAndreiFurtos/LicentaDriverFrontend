const nextConfig = {
  experimental: {
    turbo: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return process.env.NODE_ENV === 'development' ? [
      {
        source: '/api/backend/:path*',
        destination: 'https://licenta-backend.westeurope.cloudapp.azure.com:8443/api/:path*',
      },
    ] : []
  },
}

export default nextConfig
