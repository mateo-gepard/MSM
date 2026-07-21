import type { Metadata, Viewport } from 'next';
import { Manrope, Newsreader } from 'next/font/google';
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import { Footer } from '@/components/layout/Footer';
import { Navigation } from '@/components/layout/Navigation';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'MSM | Persönliche Nachhilfe online und in München',
    template: '%s | MSM Munich Scholar Mentors',
  },
  description:
    'Persönliche Nachhilfe im Einzelunterricht für Mathematik, Physik, Informatik, Biologie und Spanisch. Online oder in München. Kostenlose Probestunde für Neukund:innen.',
  applicationName: 'MSM Munich Scholar Mentors',
  keywords: [
    'Nachhilfe München',
    'Online Nachhilfe',
    'Einzelnachhilfe',
    'Mathematik Nachhilfe',
    'Physik Nachhilfe',
    'Informatik Nachhilfe',
  ],
  authors: [{ name: 'MSM Munich Scholar Mentors' }],
  creator: 'MSM Munich Scholar Mentors',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/MSM_FAVICON.png',
  },
  openGraph: {
    title: 'MSM | Persönliche Nachhilfe online und in München',
    description:
      'Persönliche Nachhilfe mit einem passenden Tutor. Online oder in München und mit kostenloser Probestunde.',
    locale: 'de_DE',
    type: 'website',
    siteName: 'MSM Munich Scholar Mentors',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Ein dunkles Notizbuch mit einer feinen violetten Lern- und Wissensgrafik',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MSM | Persönliche Nachhilfe online und in München',
    description:
      'Persönliche Nachhilfe mit einem passenden Tutor. Online oder in München und mit kostenloser Probestunde.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#191620',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${manrope.variable} ${newsreader.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">
          Zum Inhalt springen
        </a>
        <ConditionalLayout navigation={<Navigation />} footer={<Footer />}>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
