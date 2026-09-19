import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ResendButton } from '@/components/auth/resend-button';

export const metadata: Metadata = { title: 'Check your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthCard
      title="Check your email"
      description={
        <>
          We sent a confirmation link to{' '}
          <strong className="text-text">{email ?? 'your inbox'}</strong>. Open it on this device to
          finish creating your account.
        </>
      }
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      <div className="flex flex-col gap-3 text-body-sm text-muted">
        <p>Can’t find it? Check spam or promotions, or send it again.</p>
        {email && <ResendButton email={email} />}
      </div>
    </AuthCard>
  );
}
