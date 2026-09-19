import {
  ArrowRight,
  AudioLines,
  Check,
  Crown,
  Radio,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, Badge, Button, Card } from '@morphcall/ui';
import { CallPreview, IllustratedFace } from '@/components/marketing/call-preview';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

const FEATURES = [
  {
    icon: Video,
    title: 'Video calls',
    body: 'Crisp 1-to-1 calls that start in a tap, with controls that stay out of the way of the conversation.',
  },
  {
    icon: ScanFace,
    title: 'AI Identity',
    body: 'Choose an identity and your own head, face and expressions bring it to life in real time.',
    tag: 'Premium',
  },
  {
    icon: AudioLines,
    title: 'Voice changer',
    body: 'Switch voices mid-call with low latency, and go back to your natural voice in one click.',
    tag: 'Premium',
  },
  {
    icon: Radio,
    title: 'Live streaming',
    body: 'Go live to followers or subscribers and chat with your audience as it happens.',
    tag: 'Coming soon',
  },
];

const PREMIUM = [
  'AI Identity library — save and switch identities during calls',
  'AI Voice library — preview, select and switch voices',
  'Advanced video effects',
  'First access to new AI features',
];

const PEOPLE = [
  { name: 'Maya Johnson', tag: 'Singer', online: true },
  { name: 'Rin Kato', tag: 'Streamer', online: true },
  { name: 'Diego Silva', tag: 'Creator', online: false },
  { name: 'Sofia Marin', tag: 'Travel photographer', online: true },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <Badge variant="ai" className="w-fit">
                <Sparkles aria-hidden /> Real-time AI identity & voice
              </Badge>
              <h1 className="text-[40px] leading-[1.1] font-bold tracking-tight sm:text-[56px]">
                Connect. Call.
                <br />
                <span className="bg-gradient-to-r from-primary to-ai bg-clip-text text-transparent">
                  Become Anyone.
                </span>
              </h1>
              <p className="max-w-lg text-h3 font-normal text-muted">
                Meet people through live video, then express yourself differently with creative AI
                identities and voices — always clearly labelled, always in your control.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Get Started <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a href="#features">Explore</a>
                </Button>
              </div>
              <div className="flex items-center gap-3 text-body-sm text-muted">
                <div className="flex -space-x-2">
                  {PEOPLE.slice(0, 3).map((p) => (
                    <Avatar
                      key={p.name}
                      name={p.name}
                      size="sm"
                      className="ring-2 ring-bg rounded-full"
                    />
                  ))}
                </div>
                Built for creators and communities
              </div>
            </div>
            <CallPreview />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-h1 font-bold">Everything a live conversation needs</h2>
            <p className="mt-2 text-body text-muted">
              Start with a great call. Add identity and voice when you want to play.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body, tag }) => (
              <Card key={title} className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {tag && <Badge variant={tag === 'Premium' ? 'premium' : 'neutral'}>{tag}</Badge>}
                </div>
                <h3 className="text-h3 font-semibold">{title}</h3>
                <p className="text-body-sm text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* AI identity demonstration */}
        <section id="ai-identity" className="scroll-mt-20 border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div className="flex items-center justify-center gap-4">
              <figure className="w-40 sm:w-52">
                <div className="aspect-[4/5] overflow-hidden rounded-lg border border-border">
                  <IllustratedFace hue={210} variant="a" />
                </div>
                <figcaption className="mt-2 text-center text-caption text-muted">
                  Original
                </figcaption>
              </figure>
              <ArrowRight className="size-6 shrink-0 text-ai" aria-hidden />
              <figure className="w-40 sm:w-52">
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-ai/50">
                  <IllustratedFace hue={290} variant="b" />
                  <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-ai">
                    AI
                  </span>
                </div>
                <figcaption className="mt-2 text-center text-caption text-muted">
                  AI Identity
                </figcaption>
              </figure>
            </div>
            <div className="flex flex-col gap-4">
              <Badge variant="premium" className="w-fit">
                <Crown aria-hidden /> Premium
              </Badge>
              <h2 className="text-h1 font-bold">Your movement. A new look.</h2>
              <p className="text-body text-muted">
                Pick an identity from your library and apply it mid-call. Your head turns, smiles
                and speech keep driving the image in real time.
              </p>
              <ul className="flex flex-col gap-2 text-body-sm">
                {[
                  'One click → select → preview → apply, without leaving the call',
                  'Everyone in the call sees an “AI” label — it can’t be hidden',
                  'Turn it off instantly, and delete your identities whenever you like',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="text-caption text-subtle">
                AI identities are a creative effect, not a way to pass as someone else. Transformed
                video is always disclosed to the people you talk to.
              </p>
            </div>
          </div>
        </section>

        {/* Premium */}
        <section id="premium" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-h1 font-bold">Go Premium</h2>
            <p className="mt-2 text-body text-muted">
              Calls and community stay free. Premium unlocks the AI studio.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="flex flex-col gap-4 p-6">
              <p className="text-h3 font-semibold">Free</p>
              <p className="tabular text-h1 font-bold">
                $0<span className="text-body font-normal text-muted"> / forever</span>
              </p>
              <ul className="flex flex-col gap-2 text-body-sm text-muted">
                {[
                  '1-to-1 video calls',
                  'Discover people & follow',
                  'Messaging',
                  'Background blur',
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 text-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" asChild className="mt-auto">
                <Link href="/signup">Start free</Link>
              </Button>
            </Card>
            <Card className="relative flex flex-col gap-4 border-premium/60 p-6">
              <Badge variant="premium" className="absolute top-4 right-4">
                Save 17% yearly
              </Badge>
              <p className="text-h3 font-semibold">Premium</p>
              <p className="tabular text-h1 font-bold">
                $9.99<span className="text-body font-normal text-muted"> / month</span>
              </p>
              <p className="-mt-3 text-caption text-muted">or $99.99 / year</p>
              <ul className="flex flex-col gap-2 text-body-sm">
                {PREMIUM.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-premium" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="premium" asChild className="mt-auto">
                <Link href="/signup">Get Premium</Link>
              </Button>
              <p className="text-caption text-subtle">
                Pay with Paystack or card. Cancel anytime — cancelling ends Premium immediately and
                payments are non-refundable.
              </p>
            </Card>
          </div>
        </section>

        {/* Community / discovery */}
        <section id="community" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Badge variant="primary" className="w-fit">
                <Users aria-hidden /> Community
              </Badge>
              <h2 className="text-h1 font-bold">Find your people</h2>
              <p className="text-body text-muted">
                Discover people by shared interests, see who’s online now, follow creators and start
                a call when the moment’s right. Privacy controls decide who can find, message and
                call you.
              </p>
            </div>
            <Card className="divide-y divide-border">
              {PEOPLE.map((p) => (
                <div key={p.name} className="flex items-center gap-3 p-4">
                  <Avatar name={p.name} online={p.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold">{p.name}</p>
                    <p className="truncate text-caption text-muted">{p.tag}</p>
                  </div>
                  <Badge variant={p.online ? 'success' : 'neutral'}>
                    {p.online ? 'Online' : 'Away'}
                  </Badge>
                </div>
              ))}
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-h1 font-bold">Ready to meet someone new?</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-muted">
            Create your free account in under a minute.
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link href="/signup">
              Create your account <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
