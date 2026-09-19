import Link from 'next/link';
import { Button, Logo } from '@morphcall/ui';
import { ThemeToggle } from '@/components/theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="MorphCall home">
          <Logo />
        </Link>
        <nav
          aria-label="Main"
          className="hidden items-center gap-6 text-body-sm text-muted md:flex"
        >
          <a href="#features" className="hover:text-text">
            Features
          </a>
          <a href="#ai-identity" className="hover:text-text">
            AI Identity
          </a>
          <a href="#premium" className="hover:text-text">
            Premium
          </a>
          <a href="#community" className="hover:text-text">
            Community
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
