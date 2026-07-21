import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin } from 'lucide-react';

const offerLinks = [
  { label: 'Tutoren', href: '/#tutoren' },
  { label: 'Ablauf', href: '/#ablauf' },
  { label: 'Preise', href: '/#preise' },
  { label: 'Über MSM', href: '/uber-uns' },
] as const;

const legalLinks = [
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
  { label: 'AGB', href: '/agb' },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#08080b]">
      <div className="site-container py-12 sm:py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.9fr_0.7fr]">
          <div className="max-w-sm">
            <Link
              href="/"
              className="relative block h-10 w-[8.5rem] overflow-hidden rounded-sm"
              aria-label="MSM Munich Scholar Mentors – Startseite"
            >
              <Image
                src="/MSM_Logo_Light.png"
                alt=""
                width={2560}
                height={1440}
                className="absolute -left-5 -top-[1.9rem] h-[7.35rem] w-[13.1rem] max-w-none"
              />
            </Link>
            <p className="mt-5 text-sm leading-7 text-[#aaa6b2]">
              Persönliche 1:1 Nachhilfe mit jungen Tutoren – online und, je nach Tutor, vor Ort in München.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Angebot</h2>
            <ul className="mt-4 space-y-3">
              {offerLinks.map((link) => (
                <li key={link.href}>
                  <Link className="text-sm text-[#aaa6b2] hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Kontakt</h2>
            <ul className="mt-4 space-y-4 text-sm text-[#aaa6b2]">
              <li className="flex items-start gap-2.5">
                <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#9b83ff]" />
                <a className="break-all hover:text-white" href="mailto:munichscholarmentors@gmail.com">
                  munichscholarmentors@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9b83ff]" />
                <span>Online &amp; München</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">Konto &amp; Rechtliches</h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link className="text-sm text-[#aaa6b2] hover:text-white" href="/login">
                  Anmelden
                </Link>
              </li>
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link className="text-sm text-[#aaa6b2] hover:text-white" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-[#85818d] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MSM Munich Scholar Mentors</p>
          <p>1:1 Nachhilfe mit klaren Konditionen.</p>
        </div>
      </div>
    </footer>
  );
}
