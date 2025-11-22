# Elite Tutoring Munich - Setup Guide

## 🎯 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Development Server starten
```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) in deinem Browser.

---

## 📝 Nächste Schritte

### Phase 1: Website läuft ✅
- [x] Landing Page mit Hero, Features, Tutoren, Pricing
- [x] Matching Wizard (5-Schritte-System)
- [x] Booking System (5 Schritte)
- [x] Parent Dashboard (UI fertig)
- [x] Navigation & Footer
- [x] Responsive Design
- [x] Frosted Glass Effekte
- [x] Framer Motion Animationen

### Phase 2: API Integration (To-Do)
- [ ] **Supabase Auth** einrichten
  - Projekt erstellen auf supabase.com
  - Environment Variables hinzufügen
  - Auth Hooks implementieren
  - Login/Signup Pages erstellen
  
- [ ] **Cal.com** Integration
  - Account erstellen
  - Event Types konfigurieren
  - API anbinden
  - Webhooks einrichten
  
- [ ] **Sendbird Chat** Integration
  - App erstellen
  - SDK einbinden
  - Chat UI im Dashboard implementieren
  - Parent-Tutor Channels erstellen

### Phase 3: Zahlungen & E-Mails (Optional)
- [ ] **Stripe** für Payments
- [ ] **Resend** für E-Mail-Benachrichtigungen

---

## 🔐 Environment Variables Setup

1. Kopiere `.env.local.example` zu `.env.local`:
```bash
cp .env.local.example .env.local
```

2. Fülle die Werte aus (siehe `API_INTEGRATION.md` für Details):
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Cal.com
NEXT_PUBLIC_CALCOM_API_KEY=your_key
CALCOM_API_KEY=your_key

# Sendbird
NEXT_PUBLIC_SENDBIRD_APP_ID=your_app_id
SENDBIRD_API_TOKEN=your_token
```

---

## 🎨 Design System

### Farben
- **Primary Dark**: `#081525` - Haupthintergrund
- **Secondary Dark**: `#102A43` - Cards & Sections
- **Accent Purple**: `#6E56CF` - CTAs & Highlights

### CSS Utilities
```css
.frosted-glass     /* Frosted Glass Effekt */
.liquid-glass      /* Liquid Glass Effekt */
.glow-accent       /* Leuchtender Schatten */
.animate-float     /* Schwebende Animation */
```

### Komponenten
- `<Button>` - Mit variants: primary, secondary, outline
- `<FrostedCard>` - Card mit Glasmorphismus
- `<TutorCard>` - Tutor-Präsentation
- `<PricingCard>` - Pricing-Pakete

---

## 📁 Wichtige Dateien

### Pages
- `/` - Landing Page
- `/matching` - Matching Wizard
- `/booking` - Booking System
- `/dashboard` - Parent Dashboard

### Komponenten
- `src/components/layout/` - Navigation & Footer
- `src/components/sections/` - Landing Page Sections
- `src/components/tutors/` - Tutor Components
- `src/components/pricing/` - Pricing Components
- `src/components/ui/` - Reusable UI Components

### Daten & Config
- `src/data/mockData.ts` - Tutoren & Pakete
- `src/types/index.ts` - TypeScript Interfaces
- `src/lib/` - Utilities & API Clients

---

## 🚀 Deployment

### Vercel (Empfohlen)
```bash
# 1. Push zu GitHub
git add .
git commit -m "Initial commit"
git push origin main

# 2. Vercel Dashboard
# - New Project
# - Import GitHub Repo
# - Environment Variables hinzufügen
# - Deploy
```

### Eigener Server
```bash
npm run build
npm run start
```

---

## 📚 Dokumentation

- **README.md** - Haupt-Dokumentation
- **API_INTEGRATION.md** - Detaillierte API-Integration
- **.github/copilot-instructions.md** - Copilot Context

---

## 🐛 Troubleshooting

### Bilder werden nicht angezeigt
✅ Gelöst: Wir verwenden Unsplash CDN URLs

### Tailwind CSS funktioniert nicht
```bash
npm run dev
# Neustart des Dev-Servers
```

### TypeScript Errors
```bash
npm run build
# Zeigt alle Compile-Errors
```

---

## 💡 Tipps

1. **Entwicklung**: Nutze React DevTools & Framer Motion DevTools
2. **Testing**: Teste auf verschiedenen Bildschirmgrößen
3. **Performance**: Nutze Next.js Image Optimization
4. **SEO**: Metadata in jedem `page.tsx` definieren

---

## 📞 Support

Für Fragen oder Issues:
- Erstelle ein GitHub Issue
- Kontaktiere das Development Team

---

**Happy Coding! 🎉**
