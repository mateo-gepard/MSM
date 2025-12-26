import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { SendbirdProvider } from "@/contexts/SendbirdContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MSM Munich Scholar Mentors | Premium Nachhilfe von Olympiade-Siegern",
  description: "MSM Munich Scholar Mentors - Überqualifizierte Schüler und Studenten unterrichten 1:1 mit intensiver Vorbereitung, bilingualen Konzepten und personalisierten Lernplänen in München.",
  keywords: "Nachhilfe München, Olympiade Sieger, Premium Tutoring, MSM, Munich Scholar Mentors, Elite Tutoring",
  authors: [{ name: "MSM Munich Scholar Mentors" }],
  openGraph: {
    title: "MSM Munich Scholar Mentors",
    description: "Premium Nachhilfe von Olympiade-Siegern in München",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="de" data-scroll-behavior="smooth">
        <head>
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/MSM_FAVICON.png" />
          <link rel="icon" type="image/png" sizes="192x192" href="/MSM_FAVICON.png" />
          <link rel="icon" type="image/png" sizes="512x512" href="/MSM_FAVICON.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="theme-color" content="#081525" />
        </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SendbirdProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </SendbirdProvider>
      </body>
    </html>
  );
}
