import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.fbsbx.com' },
      { protocol: 'https', hostname: '**.twimg.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'unavatar.io' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: 'telegram.org' },
      { protocol: 'https', hostname: '**.telegram.org' },
      { protocol: 'https', hostname: 't.me' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktok.com' },
      { protocol: 'https', hostname: 'tiktok.com' },
      { protocol: 'https', hostname: '**.akamaized.net' },
    ],
  },
  async rewrites() {
    // If we're on Vercel (production), ALWAYS use the Render backend. 
    // This fixes the 404 Google Auth DNS private IP error without needing Vercel env configs.
    const isProd = process.env.NODE_ENV === 'production';
    const backendUrl = isProd ? 'https://pablosmm.onrender.com' : (process.env.BACKEND_URL || 'http://localhost:8080');
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
