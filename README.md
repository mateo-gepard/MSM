# 🎓 Elite Tutoring Munich

Eine Premium-Nachhilfe-Plattform für München, die Schüler und Studenten mit überqualifizierten Tutoren verbindet – Olympiade-Sieger, Wettbewerbs-Gewinner und Fach-Experten.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11.0-ff0055)

## ✨ Features

### 🏠 Landing Page
- **Hero Section** mit animierten Hintergrund-Elementen und Parallax-Effekten
- **Features Section** mit Icons und Frosted Glass Cards
- **Tutoren-Galerie** mit 6 Elite-Tutoren inkl. Achievements und Bewertungen
- **Pricing Section** mit 5 verschiedenen Paketen (Probestunde, Einzelstunde, 5er/10er-Paket, Olympiaden-Vorbereitung)
- Responsive Design mit modernen UI-Effekten

### 🧭 Matching Wizard (5 Schritte)
1. **Fächerauswahl** - Mehrfachauswahl aus 10 Fächern
2. **Ziel** - Olympiade, Notenverbesserung, Begeisterung, etc.
3. **Lernstil** - Visuell, Auditiv, Praktisch, Lesen/Schreiben
4. **Zeitrahmen** - Sofort, Bald, Flexibel
5. **Sprache** - Deutsch, Englisch, Spanisch, Französisch

### 📅 Booking System
- **Schritt 1:** Fach & Tutor auswählen
- **Schritt 2:** Service/Paket wählen
- **Schritt 3:** Datum & Uhrzeit
- **Schritt 4:** Online oder Vor Ort
- **Schritt 5:** Kontaktdaten
- Integration mit Matching-Daten (überspringt Schritte wenn vom Wizard kommend)
- Probestunde nur für Neukunden

### 📊 Parent Dashboard
- **Buchungen-Tab**: Übersicht aller Buchungen mit Status (Geplant, Abgeschlossen, Storniert)
- **Nachrichten-Tab**: Kommunikation mit Tutoren (Sendbird-Ready)
- **Kalender-Tab**: Zeitliche Übersicht aller Termine (Cal.com-Ready)
- **Profil-Tab**: Account-Verwaltung mit Supabase Auth

## 🎨 Design System

### Farbpalette
```css
--primary-dark: #081525    /* Haupthintergrund */
--secondary-dark: #102A43  /* Sekundärer Hintergrund */
--accent-purple: #6E56CF   /* Akzentfarbe für CTAs */
```

### UI-Effekte
- **Frosted Glass**: `backdrop-blur` mit Transparenz
- **Liquid Glass**: Erweiterte Glasmorphismus-Effekte
- **Hover-to-Enlarge**: Scale-Transform bei Hover
- **Parallax Scrolling**: Animated Background Elements
- **Smooth Animations**: Framer Motion für alle Übergänge

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: lucide-react
- **Image Handling**: Next/Image mit Unsplash

### Backend & Services (Ready to Integrate)
- **Authentication**: Supabase Auth
  - E-Mail/Passwort + Magic Link
  - Account-Erstellung nach erster Buchung
  
- **Booking**: Cal.com API
  - Event Types für verschiedene Produkte
  - Tutor-Verfügbarkeiten
  - Webhooks für Dashboard-Integration
  
- **Messaging**: Sendbird Chat API
  - 1:1 Chat zwischen Eltern und Tutoren
  - Echtzeit-Benachrichtigungen
  
- **Payments**: Stripe (optional)
  - Sichere Zahlungsabwicklung
  - Paket- und Einzelbuchungen

## 🚀 Getting Started

### Installation

```bash
# Repository klonen
git clone <your-repo-url>
cd romaverbessert

# Dependencies installieren
npm install

# Development Server starten
npm run dev
```

Die App läuft auf [http://localhost:3000](http://localhost:3000)

### Umgebungsvariablen

Erstelle eine `.env.local` Datei (siehe `.env.local.example`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cal.com
NEXT_PUBLIC_CALCOM_API_KEY=your_calcom_api_key
CALCOM_API_KEY=your_calcom_api_key

# Sendbird
NEXT_PUBLIC_SENDBIRD_APP_ID=your_sendbird_app_id
SENDBIRD_API_TOKEN=your_sendbird_api_token
```

## 📁 Projektstruktur

```
romaverbessert/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing Page
│   │   ├── layout.tsx            # Root Layout mit Navigation
│   │   ├── matching/
│   │   │   └── page.tsx          # Matching Wizard
│   │   ├── booking/
│   │   │   └── page.tsx          # Booking System
│   │   └── dashboard/
│   │       └── page.tsx          # Parent Dashboard
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navigation.tsx    # Haupt-Navigation
│   │   │   └── Footer.tsx        # Footer
│   │   ├── sections/
│   │   │   ├── Hero.tsx          # Hero Section
│   │   │   ├── FeaturesSection.tsx
│   │   │   ├── TutorsSection.tsx
│   │   │   └── PricingSection.tsx
│   │   ├── tutors/
│   │   │   └── TutorCard.tsx     # Tutor Card Komponente
│   │   ├── pricing/
│   │   │   └── PricingCard.tsx   # Pricing Card
│   │   └── ui/
│   │       ├── Button.tsx        # Wiederverwendbare Button
│   │       └── FrostedCard.tsx   # Frosted Glass Card
│   ├── data/
│   │   └── mockData.ts           # Mock-Daten für Tutoren & Pakete
│   ├── lib/
│   │   ├── supabase.ts           # Supabase Client
│   │   └── utils.ts              # Utility Functions
│   └── types/
│       └── index.ts              # TypeScript Interfaces
├── .github/
│   └── copilot-instructions.md   # Copilot Context
└── .env.local.example            # Umgebungsvariablen Template
```

## 🔧 API Integration Guide

### Supabase Auth Setup
1. Projekt erstellen auf [supabase.com](https://supabase.com)
2. Projekt-URL und Anon Key in `.env.local` einfügen
3. Authentication aktivieren (E-Mail/Passwort)
4. Optional: Magic Link für passwortlose Anmeldung

### Cal.com Integration
1. Account erstellen auf [cal.com](https://cal.com)
2. API Key generieren
3. Event Types erstellen:
   - Probestunde (kostenlos)
   - Einzelstunde
   - 5er-Paket
   - 10er-Paket
   - Olympiaden-Vorbereitung
4. Webhooks für Buchungsbestätigungen einrichten

### Sendbird Chat
1. App erstellen auf [sendbird.com](https://sendbird.com)
2. App ID und API Token in `.env.local`
3. Chat UI in Dashboard integrieren
4. User-to-User Messaging aktivieren

## 🎯 Roadmap

- [x] Landing Page mit Hero, Features, Tutoren, Pricing
- [x] Matching Wizard (5 Schritte)
- [x] Booking System (5 Schritte)
- [x] Parent Dashboard (Buchungen, Nachrichten, Kalender, Profil)
- [ ] Supabase Auth vollständig integrieren
- [ ] Cal.com API anbinden
- [ ] Sendbird Chat implementieren
- [ ] Stripe Payments integrieren
- [ ] Tutor-Dashboard erstellen
- [ ] E-Mail-Benachrichtigungen (z.B. via Resend)
- [ ] Review-System für Tutoren
- [ ] Admin-Panel

## 🎨 Design Principles

- **Professional but Approachable**: Hochwertig aber nicht einschüchternd
- **Quality over Quantity**: Fokus auf wenige, aber exzellente Tutoren
- **No Emojis in Production**: Icons statt Emojis (außer in UI-Beispielen)
- **Frosted Glass**: Moderne Glasmorphismus-Effekte
- **Smooth Animations**: Alle Übergänge mit Framer Motion
- **Mobile First**: Responsive Design für alle Geräte

## 📝 Scripts

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build für Production
npm run start        # Start production server

# Code Quality
npm run lint         # ESLint prüfen
```

## 🤝 Contributing

Dieses Projekt ist für Elite Tutoring Munich entwickelt. Für Änderungen oder Erweiterungen, bitte ein Issue erstellen.

## 📄 License

Proprietary - Alle Rechte vorbehalten © 2025 Elite Tutoring Munich

---

**Built with ❤️ in Munich**
