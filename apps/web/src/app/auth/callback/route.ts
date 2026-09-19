import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { supabaseServer } from '@/lib/supabase/server';

/** OAuth / email-link landing: exchanges the PKCE code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  const message = searchParams.get('error_description') ?? 'That link is invalid or has expired.';
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}
