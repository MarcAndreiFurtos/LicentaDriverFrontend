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
        destination: 'https://licentabackend-f2dpe8f5fjh8bff4.germanywestcentral-01.azurewebsites.net/api/:path*',
      },
    ] : []
  },
}

export default nextConfig
