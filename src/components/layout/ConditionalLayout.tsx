'use client';

import { usePathname } from 'next/navigation';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  navigation: React.ReactNode;
  footer: React.ReactNode;
}

export function ConditionalLayout({ children, navigation, footer }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const usesStandaloneLayout =
    pathname.startsWith('/tutor-dashboard') || pathname.startsWith('/tutor-login');

  if (usesStandaloneLayout) {
    return (
      <main id="main-content" className="min-h-screen bg-primary-dark">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary-dark">
      {navigation}
      <main id="main-content" className="flex-1 bg-primary-dark">
        {children}
      </main>
      {footer}
    </div>
  );
}
