import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin } from 'lucide-react';

const offerLinks = [
  { label: 'Tutoren', href: '/#tutoren' },
  { label: 'Warum MSM?', href: '/#ablauf' },
  { label: 'Preise', href: '/#preise' },
  { label: 'Über uns', href: '/uber-uns' },
  { label: 'Matching', href: '/matching' },
] as const;

const legalLinks = [
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
  { label: 'AGB', href: '/agb' },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--canvas-soft)]">
      <div className="site-container py-12 sm:py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.9fr_0.7fr]">
          <div className="max-w-sm">
            <Link
              href="/"
              className="relative block h-[3.25rem] w-[10.5rem] overflow-hidden rounded-sm"
              aria-label="MSM Munich Scholar Mentors, Startseite"
            >
              <Image
                src="/MSM_Logo_Light.png"
                alt=""
                width={2560}
                height={1440}
                className="absolute -left-5 -top-[1.9rem] h-[7.35rem] w-[13.1rem] max-w-none"
              />
            </Link>
            <p className="mt-5 text-sm font-semibold text-[var(--purple-soft)]">
              Don&apos;t be good be excellent
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
              Persönliche Nachhilfe im Einzelunterricht mit jungen Tutoren. Online und je nach Tutor vor Ort in München.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Quick Links</h2>
            <ul className="mt-4 space-y-3">
              {offerLinks.map((link) => (
                <li key={link.href}>
                  <Link className="text-sm text-[var(--ink-muted)] hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Kontakt</h2>
            <ul className="mt-4 space-y-4 text-sm text-[var(--ink-muted)]">
              <li className="flex items-start gap-2.5">
                <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9b83ff]" />
                <a className="break-all hover:text-white" href="mailto:munichscholarmentors@gmail.com">
                  munichscholarmentors@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9b83ff]" />
                <span>München, Deutschland</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Konto &amp; Rechtliches</h2>
            <ul className="mt-4 space-y-3">
              <li>
                  <Link className="text-sm text-[var(--ink-muted)] hover:text-white" href="/login">
                  Anmelden
                </Link>
              </li>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link className="text-sm text-[var(--ink-muted)] hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--line)] pt-6 text-xs text-[var(--ink-subtle)]">
          <p>© {new Date().getFullYear()} MSM Munich Scholar Mentors. Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </footer>
  );
}
