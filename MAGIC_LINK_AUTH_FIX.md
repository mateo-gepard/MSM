# Magic Link Auth Fix

## Problem
Magic Link funktioniert beim ersten Login, aber bei weiteren Logins werden Benutzer zur Login-Seite weitergeleitet anstatt zum Dashboard.

## Lösung
Eine dedizierte Auth-Callback-Route erstellt, die den Authorization Code von Supabase verarbeitet und dann zur gewünschten Seite weiterleitet.

## Implementierung

### 1. Auth Callback Route erstellt
- **Datei**: `src/app/auth/callback/route.ts`
- **Funktion**: Verarbeitet den Authorization Code und tauscht ihn gegen eine Session aus
- **Flow**:
  1. Empfängt `code` Parameter von Supabase
  2. Empfängt `next` Parameter (Ziel-URL)
  3. Tauscht Code gegen Session aus
  4. Leitet zur Ziel-URL weiter

### 2. sendMagicLink aktualisiert
- **Datei**: `src/lib/auth.ts`
- **Änderung**: `emailRedirectTo` zeigt jetzt auf `/auth/callback?next=...`
- **Vorteil**: Konsistenter Auth-Flow für alle Magic Link Logins

## Supabase-Konfiguration erforderlich

In der Supabase-Konsole unter Authentication > URL Configuration müssen folgende URLs hinzugefügt werden:

### Site URL
```
http://localhost:3000
```

### Redirect URLs
```
http://localhost:3000/auth/callback
http://localhost:3000/dashboard
http://localhost:3000/booking
```

Für Production:
```
https://yourdomain.com/auth/callback
https://yourdomain.com/dashboard
https://yourdomain.com/booking
```

## Testing

1. **Erster Login mit Magic Link**:
   - Gehe zu `/login`
   - Wähle "Login ohne Passwort"
   - Gib E-Mail ein
   - Klicke auf Link in E-Mail
   - Sollte zu Dashboard weiterleiten

2. **Weiterer Login mit Magic Link**:
   - Logout
   - Wiederhole den Prozess
   - Sollte ebenfalls zum Dashboard weiterleiten

3. **Booking Flow mit Magic Link**:
   - Starte Matching-Prozess
   - Wähle Tutor
   - Wähle "Login ohne Passwort"
   - Klicke auf Link in E-Mail
   - Sollte zur Booking-Seite mit gespeichertem Tutor weiterleiten

## Technische Details

### Code Exchange Flow
Der Authorization Code Flow ist sicherer als direkte Token-Übergabe:
1. Supabase sendet Magic Link mit `code` Parameter
2. User klickt auf Link → landet bei `/auth/callback?code=...&next=...`
3. Server tauscht Code gegen Session
4. User wird zur Ziel-Seite weitergeleitet mit aktiver Session

### Session Management
- Session wird serverseitig gesetzt (sicherer)
- Client-Side-Code erhält Session automatisch
- `useAuth` Hook erkennt Session-Änderungen
- Funktioniert konsistent für alle Login-Methoden

## Mögliche Probleme

1. **"Email link is invalid or has expired"**
   - Lösung: Link nur einmal verwenden
   - Ursache: Code kann nur einmal eingelöst werden

2. **Weiterleitung funktioniert nicht**
   - Prüfe Supabase Redirect URLs
   - Prüfe `next` Parameter in URL

3. **Session wird nicht gesetzt**
   - Prüfe cookies() in route.ts
   - Prüfe Supabase Auth Settings
