import type { NextConfig } from 'next';

/**
 * Same-origin API access (D-038): the browser only ever talks to
 * /backend/* on this origin; Next rewrites proxy it to the API. This removes
 * CORS from the trust model in dev and matches production, where NGINX
 * routes /backend/* to the API service (Phase 15).
 */
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
