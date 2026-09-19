import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Free forever. You must be 18 or older to use MorphCall."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
