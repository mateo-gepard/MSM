'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from './Navigation';
import { Footer } from './Footer';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide navigation and footer on tutor dashboard and tutor login pages
  const isTutorPage = pathname?.startsWith('/tutor-dashboard') || pathname?.startsWith('/tutor-login');
  
  if (isTutorPage) {
    return <div className="min-h-screen bg-primary-dark">{children}</div>;
  }
  
  return (
    <div className="min-h-screen bg-primary-dark">
      <Navigation />
      <main className="bg-primary-dark">{children}</main>
      <Footer />
    </div>
  );
}
