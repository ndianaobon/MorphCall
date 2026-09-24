import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

/** This machine's current wifi/LAN addresses, so a phone can open the dev server. */
const localAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net && net.family === 'IPv4' && !net.internal)
  .map((net) => net!.address);

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Camera/mic only for our own origin (onboarding device check, calls from Stage 2).
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@morphcall/ui'],
  // A production build run while `next dev` is up would otherwise overwrite the dev
  // server's .next and leave every route 404 until it is deleted.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Picked up fresh on each start, so a new DHCP lease doesn't break phone access.
  allowedDevOrigins: localAddresses,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
