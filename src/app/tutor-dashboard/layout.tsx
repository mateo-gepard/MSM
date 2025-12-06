import { ReactNode } from 'react';
import { Geist, Geist_Mono } from "next/font/google";
import { SendbirdProvider } from "@/contexts/SendbirdContext";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function TutorDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Custom layout for tutor dashboard - no Navigation or Footer
  return (
    <html lang="de" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SendbirdProvider>
          {children}
        </SendbirdProvider>
      </body>
    </html>
  );
}
