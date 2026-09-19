import { Logo } from '@morphcall/ui';

const COLUMNS = [
  { title: 'Product', links: ['Video Calls', 'AI Identity', 'Voice Changer', 'Live Streaming'] },
  { title: 'Company', links: ['About', 'Careers', 'Press', 'Legal'] },
  { title: 'Support', links: ['Help Center', 'Safety & Moderation', 'Contact', 'Privacy'] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-body-sm text-muted">
            Create, transform, and connect through video. Trusted identity controls and next-gen
            voice tech for creators and communities.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-2">
            <p className="text-body-sm font-semibold">{col.title}</p>
            <ul className="flex flex-col gap-1.5">
              {col.links.map((l) => (
                <li key={l}>
                  <span className="text-body-sm text-muted">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-caption text-subtle sm:px-6">
          © {new Date().getFullYear()} MorphCall Inc. All rights reserved. AI-transformed video and
          voice are always labelled to everyone in the call.
        </p>
      </div>
    </footer>
  );
}
