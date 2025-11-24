# Magic Link & Buchungspersistenz - Kompletter Flow

## Wie funktioniert der Magic Link Login mit Buchungen?

### Wichtig: Magic Link erstellt automatisch einen Account!
Wenn ein User zum ersten Mal einen Magic Link anfordert, wird **automatisch ein Account in Supabase erstellt**. Der User muss kein Passwort setzen und hat trotzdem einen permanenten Account.

### 1. User startet Buchung (ohne Account)
- User durchläuft Matching Wizard oder geht direkt zu `/booking`
- System erkennt: User ist nicht eingeloggt
- **Buchungsdaten werden in localStorage gespeichert** als `pendingBooking`:
  ```json
  {
    "subject": "Mathematik",
    "tutor": "1",
    "package": "basic",
    "date": "2025-11-25",
    "time": "14:00",
    "location": "online"
  }
  ```
- User wird zu `/login?redirect=/booking&message=login-required` weitergeleitet

### 2. User wählt "Magic Link" Login
- User gibt Email ein
- System sendet Magic Link via Supabase Auth
- **Magic Link enthält Redirect URL**: `/booking` (wird automatisch mitgesendet)
- Email wird verschickt mit Link wie: `https://app.supabase.io/auth/v1/verify?token=...&redirect_to=https://elitetutoring.com/booking`

### 3. User klickt auf Magic Link
- **Supabase erstellt automatisch Account** (wenn Email noch nicht existiert)
- User wird eingeloggt
- User wird zu `/booking` weitergeleitet (via `emailRedirectTo`)

### 4. Booking Page nach Login
- `useAuth()` Hook erkennt: User ist eingeloggt
- **Booking Page lädt `pendingBooking` aus localStorage**
- Alle gespeicherten Daten werden wiederhergestellt:
  - Selected Subject ✓
  - Selected Tutor ✓
  - Selected Package ✓
  - Selected Date/Time ✓
  - Selected Location ✓
- `pendingBooking` wird aus localStorage gelöscht (wurde verarbeitet)
- User kann Buchung abschließen

### 5. Buchung wird abgeschlossen
- Buchung wird an Cal.com API gesendet (wenn konfiguriert)
- **Buchung wird in Supabase gespeichert** mit `user_id`:
  ```sql
  INSERT INTO bookings (
    calcom_booking_id,
    user_id,           -- <-- Wichtig: Verknüpfung mit User
    tutor_id,
    subject,
    date,
    time,
    status
  ) VALUES (...)
  ```
- Zusätzlich wird Buchung in **user-spezifischem localStorage** gespeichert als Backup:
  - Key: `userBookings_{user_id}` (z.B. `userBookings_abc123`)

### 6. Zukunftsnutzung & Dashboard
- User loggt sich später wieder ein (via Magic Link oder Password)
- Dashboard lädt Buchungen **primär aus Supabase**:
  ```typescript
  const bookings = await getUserBookings(user.id);
  ```
- **Fallback**: Falls Supabase nicht erreichbar, nutzt System localStorage
- User sieht alle seine Buchungen im Dashboard

## Zukünftige Logins

### Der User HAT jetzt einen Account!
Nach dem ersten Magic Link existiert der User-Account permanent in Supabase. Für zukünftige Logins gibt es mehrere Optionen:

### Option 1: Magic Link (Empfohlen - kein Passwort nötig)
1. User geht zu `/login`
2. Klickt auf "Login ohne Passwort (Magic Link)"
3. Gibt Email ein
4. Bekommt neuen Magic Link per Email
5. Klickt Link → sofort eingeloggt ✅

**Vorteile:**
- Kein Passwort merken
- Sicher (Link läuft ab)
- Funktioniert auch für neue User

### Option 2: Passwort Login (Optional)
User kann später ein Passwort setzen:
1. Im Dashboard → "Passwort setzen"
2. Oder via "Passwort vergessen" Flow
3. Dann normal mit Email + Passwort einloggen

### Option 3: Social Login (Falls aktiviert)
- Google
- GitHub
- Etc.

### UX-Verbesserung auf Login-Seite:
Die Login-Seite zeigt jetzt einen Info-Banner bei Magic Link:
```
🔑 Login ohne Passwort
Gib deine E-Mail ein und erhalte einen Login-Link.
Funktioniert auch wenn du noch keinen Account hast - 
wir erstellen automatisch einen für dich.
```

Dies macht klar, dass:
- Magic Link für neue UND bestehende User funktioniert
- Kein Passwort notwendig ist
- Der Account automatisch erstellt wird

## Wichtige Code-Stellen

### Auth (Magic Link):
```typescript
// src/lib/auth.ts
export async function sendMagicLink(email: string, redirectTo?: string) {
  const finalRedirect = redirectTo || '/dashboard';
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}${finalRedirect}`
    }
  });
  return { data, error };
}
```

### Booking Persistenz:
```typescript
// src/app/booking/page.tsx - Zeile 52-68
if (!loading && !user) {
  const bookingData = {
    subject: selectedSubject,
    tutor: selectedTutor,
    // ... alle Felder
  };
  localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
  router.push('/login?redirect=/booking&message=login-required');
}
```

### Buchung in Supabase speichern:
```typescript
// src/lib/calcom.ts - createBooking Funktion
const supabaseData = {
  calcom_booking_id: bookingId,
  user_id: userId,  // <-- User ID wird mitgesendet
  tutor_id: tutorId,
  // ... weitere Daten
};
await saveBookingToSupabase(supabaseData);
```

### Dashboard lädt Buchungen:
```typescript
// src/app/dashboard/page.tsx - Zeile 180+
const supabaseBookings = await getUserBookings(user.id);
if (supabaseBookings && supabaseBookings.length > 0) {
  setUserBookings(supabaseBookings);
}
```

## Datenpersistenz-Strategie

### 3-Ebenen-System:
1. **pendingBooking** (localStorage) - Temporär während Login-Flow
2. **userBookings_{userId}** (localStorage) - User-spezifischer Backup
3. **Supabase Database** (PostgreSQL) - Hauptdatenbank (persistent, server-side)

### Warum 3 Ebenen?
- **pendingBooking**: Überbrückt Login-Vorgang (wird gelöscht nach Restore)
- **userBookings_{userId}**: Offline-Fähigkeit & schneller Zugriff
- **Supabase**: Single Source of Truth, geräteübergreifend, sicher

## Zusammenfassung

✅ **Magic Link erstellt automatisch Account** wenn Email neu ist
✅ **Buchungsdaten überleben den Login-Prozess** (via localStorage)
✅ **Nach Login werden Daten wiederhergestellt** und mit user_id verknüpft
✅ **Buchungen werden in Supabase gespeichert** für dauerhafte Persistenz
✅ **User kann jederzeit auf Buchungen zugreifen** (Dashboard lädt aus Supabase)
✅ **System funktioniert auch offline** dank localStorage-Backup

## Testen des Flows

1. Öffne `/booking` ohne Login
2. Wähle Tutor, Paket, Zeit
3. Werde zu Login weitergeleitet → `pendingBooking` ist gespeichert
4. Wähle "Magic Link" und gib Email ein
5. Klicke auf Link in Email
6. Du bist wieder auf `/booking` → Daten sind wiederhergestellt
7. Schließe Buchung ab → Buchung in Supabase
8. Öffne `/dashboard` → Buchung wird angezeigt
