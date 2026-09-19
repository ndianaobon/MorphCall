import { createBrowserClient } from '@supabase/ssr';
import { env } from '../env';

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Browser Supabase client (session in cookies, shared with server components and the proxy). */
export function supabaseBrowser() {
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseKey);
  return client;
}
