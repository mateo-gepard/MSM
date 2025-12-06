'use client';

import { usePathname } from 'next/navigation';
import { Navigation } from './Navigation';
import { Footer } from './Footer';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide navigation and footer on tutor dashboard and tutor login pages
  const isTutorPage = pathname?.startsWith('/tutor-dashboard') || pathname?.startsWith('/tutor-login');
  
  if (isTutorPage) {
    return <>{children}</>;
  }
  
  return (
    <>
      <Navigation />
      <main>{children}</main>
      <Footer />
    </>
  );
}
