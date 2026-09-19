'use client';

import { AudioLines, Check, Crown, Lock, ScanFace, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, cn } from '@morphcall/ui';
import { useMe } from '@/lib/queries';

const BENEFITS = [
  {
    icon: ScanFace,
    title: 'AI Identity',
    body: 'Upload images to your identity library and apply them live during calls.',
  },
  {
    icon: AudioLines,
    title: 'AI Voice',
    body: 'Preview, select and switch voices mid-call — back to natural in one click.',
  },
  {
    icon: Sparkles,
    title: 'Advanced effects',
    body: 'Premium video effects and first access to new AI features.',
  },
];

export default function PremiumPage() {
  const { data: me } = useMe();
  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const active = me?.premium.hasPremiumAccess;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Badge variant="premium">
          <Crown aria-hidden /> Premium
        </Badge>
        <h1 className="text-h1 font-bold">Express yourself differently</h1>
        <p className="max-w-xl text-body text-muted">
          Calls and community stay free. Premium unlocks real-time AI identity and voice — always
          clearly labelled to the people you talk to.
        </p>
      </div>

      {/* D7: locked preview for free users */}
      {!active && (
        <Card className="flex flex-col items-start gap-3 border-premium/40 p-6 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-premium/15 text-premium">
            <Lock className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-h3 font-semibold">AI Identity is a Premium Feature</p>
            <p className="text-body-sm text-muted">
              Transform your appearance in real time during video calls using your saved AI
              identities.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="flex flex-col gap-2 p-5">
            <Icon className="size-5 text-premium" aria-hidden />
            <p className="font-semibold">{title}</p>
            <p className="text-body-sm text-muted">{body}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-6 p-6">
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="mx-auto inline-flex rounded-full border border-border p-1"
        >
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={interval === i}
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-4 py-1.5 text-body-sm',
                interval === i ? 'bg-premium text-white' : 'text-muted hover:text-text',
              )}
            >
              {i === 'month' ? 'Monthly' : 'Annual · save 17%'}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="tabular text-[40px] leading-none font-bold">
            {interval === 'month' ? '$9.99' : '$99.99'}
          </p>
          <p className="text-body-sm text-muted">
            per {interval}
            {interval === 'year' ? ' — about $8.33 a month' : ''}
          </p>
        </div>
        <ul className="mx-auto flex flex-col gap-2 text-body-sm">
          {[
            'AI Identity library & live transformation',
            'AI Voice library & live transformation',
            'Advanced effects',
            'Cancel anytime',
          ].map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="size-4 text-premium" aria-hidden /> {f}
            </li>
          ))}
        </ul>
        {active ? (
          <Button variant="secondary" disabled className="mx-auto">
            You’re Premium
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button variant="premium" size="lg" disabled>
              Upgrade to Premium
            </Button>
            <p className="text-caption text-muted">
              Checkout with Paystack or card opens with our payments update. Nothing is charged
              today.
            </p>
          </div>
        )}
        <p className="text-center text-caption text-subtle">
          Cancelling ends Premium immediately and payments are non-refundable. Saved identities and
          voices are kept for 30 days after Premium ends, then deleted.
        </p>
      </Card>
    </div>
  );
}
