'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail, MapPin, Instagram, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary-dark border-t border-white/10 py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Mobile-optimized grid: 2 columns on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Brand - Full width on mobile */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0">
                <Image
                  src="/MSM_Logo_Light.png"
                  alt="MSM Munich Scholar Mentors Logo"
                  width={112}
                  height={112}
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold text-white leading-tight">MSM</span>
                <span className="text-xs text-gray-400 leading-tight">Munich Scholar Mentors</span>
                <span className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">Don't be good be excellent</span>
              </div>
            </div>
          {/* End Brand column */}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/#tutors" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Tutoren
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Preise
                </Link>
              </li>
              <li>
                <Link href="/matching" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Matching
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Rechtliches</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/impressum" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/agb" className="text-gray-400 hover:text-accent active:text-accent transition-colors text-xs sm:text-sm py-1 block">
                  AGB
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact - Full width on mobile */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Kontakt</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm">
                <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent flex-shrink-0" />
                <a href="mailto:munichscholarmentors@gmail.com" className="hover:text-accent active:text-accent transition-colors truncate">
                  munichscholarmentors@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-xs sm:text-sm">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent flex-shrink-0" />
                <span>München, Deutschland</span>
              </li>
            </ul>
            {/* Social buttons removed as requested */}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 sm:pt-8 text-center">
          <p className="text-gray-400 text-xs sm:text-sm">
            © {new Date().getFullYear()} MSM Munich Scholar Mentors. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  );
}
