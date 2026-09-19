'use client';

import { Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Logo,
  OptionCards,
  Skeleton,
  Spinner,
} from '@morphcall/ui';
import { ThemeToggle } from '@/components/theme-toggle';

const COLORS = [
  'bg',
  'surface',
  'card',
  'card-elevated',
  'border',
  'border-strong',
  'text',
  'muted',
  'subtle',
  'primary',
  'ai',
  'premium',
  'success',
  'warning',
  'danger',
];

/** Living token & component specimen (docs/06 §8) — the reference for design review. */
export default function DesignPage() {
  const [chip, setChip] = useState(true);
  const [opt, setOpt] = useState<'a' | 'b'>('a');
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">Colour tokens</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {COLORS.map((c) => (
            <div key={c} className="flex flex-col gap-1">
              <div
                className="h-14 rounded-md border border-border"
                style={{ background: `var(--color-${c})` }}
              />
              <code className="text-caption text-muted">{c}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h2 font-bold">Typography</h2>
        <p className="text-display font-bold">Display 40</p>
        <p className="text-h1 font-bold">Heading 1 · 32</p>
        <p className="text-h2 font-semibold">Heading 2 · 24</p>
        <p className="text-h3 font-semibold">Heading 3 · 18</p>
        <p className="text-body">Body 15 — The quick brown fox jumps over the lazy dog.</p>
        <p className="text-body-sm text-muted">Body small 13 — secondary text</p>
        <p className="tabular text-caption text-subtle">Caption 12 · 00:12:34 tabular numbers</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">End call</Button>
          <Button variant="premium">Premium</Button>
          <Button variant="ai">
            <Sparkles /> AI Identity
          </Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="icon" aria-label="Mail">
            <Mail />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h2 font-bold">Badges, avatars, chips</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(
            ['neutral', 'primary', 'success', 'warning', 'danger', 'premium', 'ai', 'live'] as const
          ).map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Avatar name="Ava Lopez" size="xs" />
          <Avatar name="Ravi Menon" size="sm" online />
          <Avatar name="Sofia Marin" size="md" online={false} />
          <Avatar name="Diego Silva" size="lg" online />
          <Avatar name="Maya Johnson" size="xl" />
        </div>
        <div className="flex gap-2">
          <Chip selected={chip} onClick={() => setChip(!chip)}>
            Music
          </Chip>
          <Chip>Gaming</Chip>
          <Chip disabled>Disabled</Chip>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <Field id="demo-ok" label="Email" hint="We’ll never share it.">
            {(a) => <Input {...a} placeholder="you@example.com" />}
          </Field>
          <Field id="demo-err" label="Username" error="That username is taken.">
            {(a) => <Input {...a} defaultValue="admin" />}
          </Field>
          <OptionCards
            aria-label="Demo"
            value={opt}
            onValueChange={setOpt}
            options={[
              { value: 'a', label: 'Option A', description: 'Description' },
              { value: 'b', label: 'Option B' },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20" />
          <Spinner label="Loading demo" />
          <EmptyState title="Empty state" description="Nothing here yet." />
          <ErrorState description="Error state" requestId="req_123" />
        </Card>
      </section>
    </main>
  );
}
