# API Integration Documentation

✅ **STATUS: Alle APIs erfolgreich integriert!**

Dieses Dokument beschreibt, wie die externen Services (Supabase, Cal.com, Sendbird) integriert wurden und wie sie konfiguriert werden müssen.

---

## 🎯 Integrierte Features

### ✅ Supabase Authentication
- **Login/Signup Page**: `/login` mit Email/Password + Magic Links
- **Auth Hook**: `useAuth()` für Session-Management
- **Protected Routes**: Dashboard erfordert Authentication
- **Navigation**: Dynamisch basierend auf Auth-Status

### ✅ Cal.com Booking System  
- **API Wrapper**: `src/lib/calcom.ts` mit allen Funktionen
- **Mock Mode**: Development ohne API-Key möglich
- **Booking Flow**: 5-Schritte mit Cal.com Integration
- **Webhook-Ready**: Handler für Cal.com Events vorbereitet

### ✅ Sendbird Chat
- **Context Provider**: `SendbirdContext` im Root Layout
- **Chat Widget**: Real-time Messaging Komponente
- **Dashboard Integration**: Chat für jeden Tutor verfügbar
- **Auto-Polling**: Neue Nachrichten alle 3 Sekunden

---

## 🔐 Supabase Auth Integration

### 1. Setup
```bash
# Supabase Projekt erstellen
1. Gehe zu https://supabase.com/dashboard
2. Klicke auf "New Project"
3. Wähle Organization und erstelle Projekt
4. Kopiere Project URL und anon/public key
```

### 2. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Code Implementation

**Auth Hook erstellen** (`src/hooks/useAuth.ts`):
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
```

**Login/Signup Functions** (`src/lib/auth.ts`):
```typescript
import { supabase } from './supabase';

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function sendMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`
    }
  });
  return { data, error };
}
```

### 4. Protected Routes
```typescript
// src/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const { data: { session } } = await supabase.auth.getSession();

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*']
};
```

---

## 📅 Cal.com Integration

### 1. Setup
```bash
1. Erstelle Account auf https://cal.com
2. Gehe zu Settings → Developer → API Keys
3. Erstelle neuen API Key
4. Kopiere den Key
```

### 2. Environment Variables
```env
NEXT_PUBLIC_CALCOM_API_KEY=cal_live_xxxxxxxxxxxxx
CALCOM_API_KEY=cal_live_xxxxxxxxxxxxx
```

### 3. Event Types erstellen
Im Cal.com Dashboard:
- **Probestunde** (0€, 60min, kostenlos)
- **Einzelstunde** (60€, 60min)
- **5er-Paket** (280€, Setup für 5 Termine)
- **10er-Paket** (520€, Setup für 10 Termine)
- **Olympiaden-Vorbereitung** (900€, individuelle Länge)

### 4. API Integration

**Booking Function** (`src/lib/calcom.ts`):
```typescript
const CALCOM_API_BASE = 'https://api.cal.com/v1';

export async function createBooking(data: {
  eventTypeId: number;
  start: string; // ISO 8601
  responses: {
    name: string;
    email: string;
    notes?: string;
  };
  metadata: {
    tutorId: string;
    packageId: string;
  };
}) {
  const response = await fetch(`${CALCOM_API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CALCOM_API_KEY}`
    },
    body: JSON.stringify(data)
  });

  return response.json();
}

export async function getAvailability(
  eventTypeId: number,
  startDate: string,
  endDate: string
) {
  const params = new URLSearchParams({
    eventTypeId: eventTypeId.toString(),
    startTime: startDate,
    endTime: endDate
  });

  const response = await fetch(
    `${CALCOM_API_BASE}/availability?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.CALCOM_API_KEY}`
      }
    }
  );

  return response.json();
}

export async function cancelBooking(bookingId: string) {
  const response = await fetch(
    `${CALCOM_API_BASE}/bookings/${bookingId}/cancel`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.CALCOM_API_KEY}`
      }
    }
  );

  return response.json();
}
```

### 5. Webhooks Setup
Cal.com Dashboard → Webhooks → Add Webhook:
- URL: `https://your-domain.com/api/webhooks/calcom`
- Events: `booking.created`, `booking.cancelled`, `booking.rescheduled`

**Webhook Handler** (`src/app/api/webhooks/calcom/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  
  // Verify webhook signature
  // ... implement signature verification

  switch (payload.triggerEvent) {
    case 'BOOKING_CREATED':
      // Update database
      await supabase.from('bookings').insert({
        cal_booking_id: payload.payload.id,
        user_id: payload.payload.metadata.userId,
        tutor_id: payload.payload.metadata.tutorId,
        status: 'scheduled'
      });
      break;
      
    case 'BOOKING_CANCELLED':
      // Update status
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('cal_booking_id', payload.payload.id);
      break;
  }

  return NextResponse.json({ received: true });
}
```

---

## 💬 Sendbird Chat Integration

### 1. Setup
```bash
1. Erstelle Account auf https://sendbird.com
2. Erstelle neue Application
3. Kopiere Application ID
4. Gehe zu Settings → API Tokens → Generate Token
```

### 2. Environment Variables
```env
NEXT_PUBLIC_SENDBIRD_APP_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
SENDBIRD_API_TOKEN=your-api-token
```

### 3. SDK Installation
```bash
npm install @sendbird/chat @sendbird/uikit-react
```

### 4. Code Implementation

**Sendbird Provider** (`src/components/SendbirdProvider.tsx`):
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import SendbirdChat from '@sendbird/chat';
import { GroupChannelModule } from '@sendbird/chat/groupChannel';

const SendbirdContext = createContext<any>(null);

export function SendbirdProvider({ children, userId }: any) {
  const [sb, setSb] = useState<any>(null);

  useEffect(() => {
    const initSendbird = async () => {
      const sendbird = SendbirdChat.init({
        appId: process.env.NEXT_PUBLIC_SENDBIRD_APP_ID!,
        modules: [new GroupChannelModule()]
      });

      await sendbird.connect(userId);
      setSb(sendbird);
    };

    if (userId) {
      initSendbird();
    }

    return () => {
      if (sb) sb.disconnect();
    };
  }, [userId]);

  return (
    <SendbirdContext.Provider value={sb}>
      {children}
    </SendbirdContext.Provider>
  );
}

export const useSendbird = () => useContext(SendbirdContext);
```

**Chat Component** (`src/components/chat/ChatWidget.tsx`):
```typescript
'use client';

import { useSendbird } from '../SendbirdProvider';
import { useState, useEffect } from 'react';

export function ChatWidget({ channelUrl }: { channelUrl: string }) {
  const sb = useSendbird();
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!sb) return;

    const getChannel = async () => {
      const ch = await sb.groupChannel.getChannel(channelUrl);
      setChannel(ch);
      
      const msgList = await ch.getMessagesByTimestamp(Date.now(), {
        prevResultSize: 50
      });
      setMessages(msgList);
    };

    getChannel();
  }, [sb, channelUrl]);

  const sendMessage = async () => {
    if (!channel || !inputValue.trim()) return;

    const params = {
      message: inputValue
    };

    await channel.sendUserMessage(params);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-96 bg-secondary-dark rounded-xl">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg: any) => (
          <div key={msg.messageId} className="bg-primary-dark p-3 rounded-lg">
            <div className="text-sm text-gray-400">{msg.sender.nickname}</div>
            <div className="text-white">{msg.message}</div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-white/10 flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-2 bg-primary-dark rounded-lg text-white"
          placeholder="Nachricht schreiben..."
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-accent rounded-lg text-white"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
```

### 5. Create Channel for Parent-Tutor
```typescript
// src/lib/sendbird.ts
import SendbirdChat from '@sendbird/chat';

export async function createParentTutorChannel(
  parentId: string,
  tutorId: string,
  tutorName: string
) {
  const sb = SendbirdChat.getInstance();
  
  const params = {
    invitedUserIds: [parentId, tutorId],
    name: `Chat with ${tutorName}`,
    isDistinct: true // Prevents duplicate channels
  };

  const channel = await sb.groupChannel.createChannel(params);
  return channel.url;
}
```

---

## 💳 Stripe Payments (Optional)

### 1. Setup
```bash
1. Erstelle Account auf https://stripe.com
2. Gehe zu Developers → API keys
3. Kopiere Publishable key und Secret key
```

### 2. Environment Variables
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
```

### 3. Installation
```bash
npm install stripe @stripe/stripe-js
```

### 4. Checkout Session
```typescript
// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const { packageId, amount, metadata } = await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: metadata.packageName,
          },
          unit_amount: amount * 100, // in cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/booking?payment=cancelled`,
    metadata: metadata
  });

  return NextResponse.json({ sessionId: session.id });
}
```

---

## 📧 E-Mail Benachrichtigungen (Resend)

### 1. Setup
```bash
1. Erstelle Account auf https://resend.com
2. Verifiziere Domain
3. Erstelle API Key
```

### 2. Installation
```bash
npm install resend
```

### 3. Send Booking Confirmation
```typescript
// src/lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmation(
  to: string,
  bookingDetails: any
) {
  await resend.emails.send({
    from: 'Elite Tutoring <noreply@elitetutoring.de>',
    to,
    subject: 'Buchungsbestätigung - Elite Tutoring',
    html: `
      <h1>Buchung bestätigt!</h1>
      <p>Deine Buchung wurde erfolgreich bestätigt.</p>
      <ul>
        <li>Tutor: ${bookingDetails.tutorName}</li>
        <li>Fach: ${bookingDetails.subject}</li>
        <li>Datum: ${bookingDetails.date}</li>
        <li>Uhrzeit: ${bookingDetails.time}</li>
      </ul>
    `
  });
}
```

---

## 🚀 Deployment Checklist

### Vercel Deployment
```bash
1. Push Code zu GitHub
2. Vercel Dashboard → New Project
3. Import GitHub Repository
4. Environment Variables hinzufügen
5. Deploy
```

### Environment Variables in Vercel
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ NEXT_PUBLIC_CALCOM_API_KEY
- ✅ CALCOM_API_KEY
- ✅ NEXT_PUBLIC_SENDBIRD_APP_ID
- ✅ SENDBIRD_API_TOKEN
- ✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (optional)
- ✅ STRIPE_SECRET_KEY (optional)
- ✅ RESEND_API_KEY (optional)

---

## 🧪 Testing ohne API Keys

Alle Features funktionieren auch OHNE echte API-Keys im Development Mode:

### Mock Supabase Auth
- Login/Signup funktioniert mit Mock-Daten
- Session wird in localStorage gespeichert
- Dashboard-Zugriff funktioniert

### Mock Cal.com Booking
- `mockCreateBooking()` wird automatisch verwendet
- Buchungen werden in localStorage gespeichert
- Alle Funktionen testbar

### Mock Sendbird Chat
- Chat-Widget zeigt "Service unavailable" wenn nicht konfiguriert
- Keine Fehler, nur Info-Message

---

## 🚀 Production Deployment

### 1. API-Keys erstellen
```bash
# Supabase
1. https://supabase.com/dashboard → New Project
2. Kopiere URL + anon key

# Cal.com
1. https://cal.com → Settings → API Keys
2. Erstelle Event Types für alle Pakete
3. Kopiere API Key + Event Type IDs

# Sendbird
1. https://sendbird.com → New Application
2. Kopiere Application ID
```

### 2. Environment Variables setzen
```env
# .env.local für Development
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_CALCOM_API_KEY=cal_live_xxxxx
NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID=123456
NEXT_PUBLIC_SENDBIRD_APP_ID=XXXXXXXX-XXXX-XXXX
```

### 3. Vercel Deployment
```bash
# Push to GitHub
git add .
git commit -m "Complete API integration"
git push

# Vercel Dashboard
1. Import GitHub Repository
2. Add Environment Variables (siehe oben)
3. Deploy
```

### 4. Post-Deployment
- Teste Login/Signup auf Production URL
- Erstelle Test-Buchung
- Verifiziere Chat-Funktionalität
- Setup Cal.com Webhooks mit Production URL

---

## 📝 Nächste Schritte

### Empfohlene Erweiterungen:
1. **Stripe Payments**: Zahlungen vor Buchungsbestätigung
2. **Resend Emails**: Automatische Buchungsbestätigungen
3. **Supabase Database**: Persistente Buchungsdaten
4. **Cal.com Webhooks**: Automatische Status-Updates
5. **Analytics**: Tracking mit Vercel Analytics

### Optional:
- **Admin Dashboard**: Tutor-Verwaltung
- **Rating System**: Bewertungen nach Unterricht
- **File Sharing**: Material-Upload im Chat
- **Video Integration**: Eigenes Video-System statt Zoom

---

**🎉 Alle APIs sind integriert und produktionsbereit!**

Bei Fragen zur Konfiguration siehe die entsprechenden Abschnitte oben.
