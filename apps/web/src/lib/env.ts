import { resolveUrl } from './resolve-url';

/** Public runtime config. Only NEXT_PUBLIC_* values — never secrets — belong here. */
const configuredApi = process.env.NEXT_PUBLIC_API_URL;
const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;

const location = () =>
  typeof window === 'undefined'
    ? undefined
    : { protocol: window.location.protocol, hostname: window.location.hostname };

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  get apiUrl() {
    return resolveUrl({
      configured: configuredApi,
      port: 4000,
      fallback: 'http://localhost:4000',
      location: location(),
    });
  },
  get siteUrl() {
    return resolveUrl({
      configured: configuredSite,
      port: 3000,
      fallback: 'http://localhost:3000',
      location: location(),
    });
  },
};
