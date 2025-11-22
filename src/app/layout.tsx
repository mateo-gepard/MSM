import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SendbirdProvider>
          <Navigation />
          <main>{children}</main>
          <Footer />
        </SendbirdProvider>
      </body>
    </html>
  );
}
