/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vxykiwifugieiwgqnlih.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'i.picsum.photos',
      },
      {
        protocol: 'https',
        
        hostname: '*.picsum.photos',
      },
    ],
  },
}

export default nextConfig
