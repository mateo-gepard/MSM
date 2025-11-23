# Supabase Integration für MSM

Diese Anleitung erklärt, wie Cal.com-Buchungen mit Supabase-User-Accounts synchronisiert werden.

## 🎯 Was wurde implementiert?

### 1. **Supabase-Datenbank**
- Tabelle `bookings`: Speichert alle Buchungen mit User-ID-Verknüpfung
- Tabelle `tutors`: Speichert Tutor-Informationen
- Tabelle `messages`: Für zukünftige Chat-Integration
- Row Level Security (RLS): User sehen nur ihre eigenen Daten

### 2. **Cal.com ↔ Supabase Synchronisation**
- **Beim Buchen**: Buchung wird gleichzeitig in Cal.com UND Supabase gespeichert
- **Beim Stornieren**: Status wird in beiden Systemen aktualisiert
- **Beim Umbuchen**: Datum/Zeit werden in beiden Systemen synchronisiert

### 3. **Dashboard-Integration**
- Lädt Buchungen aus Supabase (statt localStorage)
- Fallback auf localStorage für Offline-Betrieb
- Zeigt nur Buchungen des eingeloggten Users

## 📋 Setup-Schritte

### Schritt 1: Supabase-Datenbank einrichten

1. Gehe zu [Supabase Dashboard](https://app.supabase.com)
2. Öffne dein Projekt: `yeudmfmnfzinjzpgkowb`
3. Gehe zu **SQL Editor** → **New Query**
4. Kopiere den gesamten Inhalt von `supabase-setup.sql`
5. Führe das SQL aus (Run)

✅ **Das erstellt:**
- Alle Tabellen (`bookings`, `tutors`, `messages`)
- RLS Policies (Sicherheit)
- Indizes (Performance)
- Beispiel-Tutoren

### Schritt 2: Auth-URLs konfigurieren

1. Gehe zu **Authentication** → **URL Configuration**
2. Trage folgende URLs ein:
   ```
   Site URL: https://msm-theta.vercel.app
   Redirect URLs:
   - https://msm-theta.vercel.app
   - https://msm-theta.vercel.app/login
   - https://msm-theta.vercel.app/dashboard
   - http://localhost:3000 (für Development)
   ```

### Schritt 3: Umgebungsvariablen in Vercel

1. Gehe zu [Vercel Dashboard](https://vercel.com)
2. Projekt öffnen → **Settings** → **Environment Variables**
3. Füge folgende Variablen hinzu:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yeudmfmnfzinjzpgkowb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldWRtZm1uZnppbmp6cGdrb3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzM3MTEsImV4cCI6MjA3OTQwOTcxMX0.WBp-4mamr_oQckNqKvL06fFoqTpstsDGh8nJKncE7rc
NEXT_PUBLIC_CALCOM_API_KEY=cal_live_579ad0501bd4f24c7c34d77acb4ef28d
NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID=3976917
CALCOM_API_KEY=cal_live_579ad0501bd4f24c7c34d77acb4ef28d
NEXT_PUBLIC_SENDBIRD_APP_ID=A30F1E34-BD5D-4B38-8FDC-DBEF4112A510
SENDBIRD_API_TOKEN=a1dfe101ec9b7b96eb91374248b0027d620548bc
```

4. **Redeploy** das Projekt

## 🔄 Wie funktioniert die Synchronisation?

### Buchung erstellen

```typescript
// booking/page.tsx
const result = await createBooking({
  eventTypeId: 3976917,
  start: '2025-01-15T14:00:00',
  responses: { name, email, notes },
  metadata: { tutorId, packageId, subject, location, phone },
  userId: user.id // ← Supabase User ID
});
```

**Was passiert intern:**
1. ✅ Buchung wird in Cal.com erstellt
2. ✅ Buchung wird automatisch in Supabase gespeichert (mit `user_id`)
3. ✅ User sieht Buchung sofort im Dashboard

### Buchung stornieren

```typescript
// dashboard/page.tsx
await cancelBooking(bookingId);
```

**Was passiert intern:**
1. ✅ Buchung wird in Cal.com storniert
2. ✅ Status wird in Supabase auf `'cancelled'` gesetzt

### Buchung umbuchen

```typescript
await rescheduleBooking(bookingId, newDate);
```

**Was passiert intern:**
1. ✅ Buchung wird in Cal.com umgebucht
2. ✅ Datum/Zeit werden in Supabase aktualisiert

## 🔒 Sicherheit (Row Level Security)

### Was ist RLS?

Row Level Security stellt sicher, dass User nur ihre eigenen Daten sehen können.

**Beispiel:**
- User A bucht am 15.01. um 14 Uhr
- User B bucht am 16.01. um 10 Uhr
- User A sieht NUR seine eigene Buchung vom 15.01.
- User B sieht NUR seine eigene Buchung vom 16.01.

### Wie funktioniert es?

```sql
-- Policy für SELECT
create policy "Users can view own bookings"
on public.bookings
for select
using (auth.uid() = user_id);
```

→ `auth.uid()` ist die ID des eingeloggten Users
→ Nur Zeilen mit `user_id = auth.uid()` werden zurückgegeben

## 📊 Dashboard-Anzeige

Das Dashboard lädt Buchungen jetzt aus Supabase:

```typescript
// dashboard/page.tsx
useEffect(() => {
  const loadBookings = async () => {
    if (user?.id) {
      const bookings = await getUserBookings(user.id);
      setUserBookings(bookings);
    }
  };
  loadBookings();
}, [user]);
```

**Vorteile:**
- ✅ Buchungen sind geräteübergreifend verfügbar
- ✅ Keine Datenverluste (nicht nur localStorage)
- ✅ Sicher durch RLS
- ✅ Automatische Synchronisation mit Cal.com

## 🧪 Testen

### 1. Buchung erstellen
1. Gehe zu `/booking`
2. Wähle Fach, Tutor, Paket, Termin
3. Gib Kontaktdaten ein
4. Klicke auf "Buchung abschließen"
5. ✅ Prüfe im Dashboard, ob die Buchung erscheint
6. ✅ Prüfe in Supabase Table Editor, ob die Buchung gespeichert wurde

### 2. Buchung stornieren
1. Gehe zu `/dashboard`
2. Klicke auf "Stornieren" bei einer Buchung
3. Bestätige die Stornierung
4. ✅ Status sollte auf "Storniert" wechseln
5. ✅ Prüfe in Supabase, ob `status = 'cancelled'`

### 3. Buchung umbuchen
1. Gehe zu `/dashboard`
2. Klicke auf "Umbuchen" bei einer Buchung
3. Wähle neuen Termin
4. ✅ Datum/Zeit sollten aktualisiert werden
5. ✅ Prüfe in Supabase die neuen Werte

## 🐛 Troubleshooting

### Problem: Buchungen erscheinen nicht im Dashboard

**Lösung:**
1. Prüfe, ob RLS aktiviert ist: `alter table public.bookings enable row level security;`
2. Prüfe, ob Policies existieren: Supabase → Authentication → Policies
3. Prüfe Browser Console auf Fehler

### Problem: "User not authenticated"

**Lösung:**
1. Prüfe, ob User eingeloggt ist: `console.log(user)`
2. Prüfe Supabase Auth-URLs (siehe Schritt 2)
3. Prüfe Umgebungsvariablen in Vercel

### Problem: Buchung nur in Cal.com, nicht in Supabase

**Lösung:**
1. Prüfe, ob `userId` übergeben wird: `console.log('userId:', user.id)`
2. Prüfe Browser Console auf Supabase-Fehler
3. Prüfe Supabase Logs: Dashboard → Logs → API

## 📝 Nächste Schritte

1. **Webhook für Cal.com** (optional):
   - Erstelle `/api/webhooks/calcom` für automatische Updates
   - Registriere Webhook in Cal.com Dashboard

2. **Admin-Dashboard** (optional):
   - Erstelle Admin-Rolle in Supabase
   - Zeige alle Buchungen für Admins

3. **E-Mail-Benachrichtigungen** (optional):
   - Integriere Resend API
   - Sende Bestätigungs-E-Mails nach Buchung

## ✅ Fertig!

Die Integration ist vollständig implementiert. Alle Buchungen werden jetzt automatisch zwischen Cal.com und Supabase synchronisiert und sind mit User-Accounts verknüpft.

**Bei Fragen:** Dokumentation prüfen oder Support kontaktieren.
