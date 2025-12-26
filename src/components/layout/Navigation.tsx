'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Menu, X, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Start', href: '/' },
    { label: 'Über uns', href: '/uber-uns' },
    { label: 'Tutoren', href: '/#tutors' },
    { label: 'Preise', href: '/#pricing' }
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'frosted-glass shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <div className="relative px-0 py-0 transition-opacity group-hover:opacity-80">
              <Image
                src="/MSM_Logo_Light.png"
                alt="MSM Munich Scholar Mentors"
                width={220}
                height={50}
                className="object-contain h-auto w-[180px] sm:w-[220px]"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <Link href="/dashboard">
                <Button size="sm">
                  <User className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="sm" variant="outline">Login</Button>
                </Link>
                <Link href="/matching">
                  <Button size="sm">Erstgespräch</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2 -mr-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute left-0 right-0 top-full bg-primary-dark/95 backdrop-blur-xl border-t border-b border-white/10 shadow-2xl"
          >
            <div className="container mx-auto px-4 py-6 flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-300 hover:text-white active:text-accent transition-colors font-medium py-3 px-4 rounded-xl hover:bg-white/5 active:bg-white/10"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-white/10 my-2" />
              {user ? (
                <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button size="lg" className="w-full py-4">
                    <User className="w-5 h-5 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button size="lg" variant="outline" className="w-full py-4">Login</Button>
                  </Link>
                  <Link href="/matching" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button size="lg" className="w-full py-4">Erstgespräch</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}
