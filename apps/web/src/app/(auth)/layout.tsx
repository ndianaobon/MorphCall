import Link from 'next/link';
import { Logo } from '@morphcall/ui';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/15 to-transparent"
      />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="MorphCall home">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
