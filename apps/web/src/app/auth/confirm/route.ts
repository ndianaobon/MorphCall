import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { supabaseServer } from '@/lib/supabase/server';

/** Token-hash email links (custom email templates): signup confirmation, recovery, email change. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(
    searchParams.get('next'),
    type === 'recovery' ? '/reset-password' : '/onboarding',
  );

  if (tokenHash && type) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('That link is invalid or has expired.')}`,
  );
}
