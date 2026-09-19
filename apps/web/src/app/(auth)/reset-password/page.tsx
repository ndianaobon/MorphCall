'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@morphcall/ui';
import { AuthCard } from '@/components/auth/auth-card';
import { NewPasswordField } from '@/components/auth/password-input';
import { passwordOk } from '@/components/auth/password-rules';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes('session')
          ? 'This reset link has expired. Request a new one.'
          : error.message,
      );
      return;
    }
    toast.success('Password updated.');
    router.replace('/home');
    router.refresh();
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Use something you don’t use anywhere else."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}
        <NewPasswordField value={password} onChange={setPassword} label="New password" />
        <Button type="submit" loading={loading} disabled={!passwordOk(password)}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
