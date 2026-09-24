/** Public runtime config. Only NEXT_PUBLIC_* values — never secrets — belong here. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};
