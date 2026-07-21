'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const navigationItems = [
  { label: 'Tutoren', href: '/#tutoren' },
  { label: 'So funktioniert’s', href: '/#ablauf' },
  { label: 'Preise', href: '/#preise' },
  { label: 'Über MSM', href: '/uber-uns' },
] as const;

export function Navigation() {
  const currentPath = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    firstLinkRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090d]/95 backdrop-blur-md">
      <nav className="site-container" aria-label="Hauptnavigation">
        <div className="flex h-[4.75rem] items-center justify-between gap-6">
          <Link
            href="/"
            className="relative h-10 w-[8.5rem] shrink-0 overflow-hidden rounded-sm"
            aria-label="MSM Munich Scholar Mentors – Startseite"
          >
            <Image
              src="/MSM_Logo_Light.png"
              alt=""
              width={2560}
              height={1440}
              className="absolute -left-5 -top-[1.9rem] h-[7.35rem] w-[13.1rem] max-w-none"
              priority
            />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {navigationItems.map((item) => {
              const isCurrent = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className="rounded-lg px-3.5 py-2.5 text-sm font-semibold text-[#b5b1bf] transition-colors hover:bg-white/5 hover:text-white aria-[current=page]:text-white"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d8d4df] transition-colors hover:text-white"
            >
              Anmelden
            </Link>
            <Link
              href="/matching"
              className="rounded-lg bg-[#6e56cf] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#745bd1]"
            >
              Tutor finden
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 text-white transition-colors hover:bg-white/5 lg:hidden"
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        {isOpen ? (
          <div id="mobile-navigation" className="border-t border-white/10 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {navigationItems.map((item, index) => (
                <Link
                  ref={index === 0 ? firstLinkRef : undefined}
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === currentPath ? 'page' : undefined}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-[#d8d4df] hover:bg-white/5 hover:text-white aria-[current=page]:text-white"
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 px-4 text-sm font-bold text-white"
                onClick={closeMenu}
              >
                Anmelden
              </Link>
              <Link
                href="/matching"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#6e56cf] px-4 text-sm font-bold text-white"
                onClick={closeMenu}
              >
                Tutor finden
              </Link>
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
