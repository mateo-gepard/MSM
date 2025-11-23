# Cal.com "no_available_users_found_error" Fix

## Problem
```
no_available_users_found_error
```

Dieser Fehler bedeutet, dass Cal.com keinen verfügbaren Host für die Buchung findet.

## Ursachen

### 1. Event Type hat keinen Host zugewiesen
- Gehe zu [Cal.com Dashboard](https://app.cal.com)
- Gehe zu **Event Types**
- Öffne deinen Event Type (ID: 3976917)
- Stelle sicher, dass unter **"Host"** ein User zugewiesen ist

### 2. Keine Availability konfiguriert
- Gehe zu **Availability** in Cal.com
- Stelle sicher, dass du Verfügbarkeitszeiten eingestellt hast
- Z.B.: Mo-Fr 9:00-18:00 Uhr

### 3. Event Type ist nicht aktiv
- Prüfe ob der Event Type **"Active"** ist
- Toggle den Status auf "Active" wenn nötig

## Lösung Schritt-für-Schritt

### Option A: Bestehenden Event Type reparieren

1. **Cal.com Dashboard öffnen**: https://app.cal.com/event-types
2. **Event Type bearbeiten** (ID: 3976917)
3. **Unter "Hosts"**:
   - Füge dich selbst als Host hinzu
   - Oder erstelle einen neuen User
4. **Unter "Availability"**:
   - Stelle Verfügbarkeitszeiten ein
   - Z.B.: Montag-Freitag, 9:00-18:00
5. **Speichern** und testen

### Option B: Neuen Event Type erstellen

1. **Neuen Event Type erstellen**:
   - Name: "MSM Tutoring Session"
   - Duration: 60 Minuten
   - Location: Online (Zoom/Google Meet)

2. **Host zuweisen**:
   - Dich selbst als Host hinzufügen

3. **Availability setzen**:
   ```
   Montag-Freitag: 09:00-18:00
   Samstag: 10:00-14:00
   Sonntag: Geschlossen
   ```

4. **Event Type ID kopieren**:
   - URL Format: `https://app.cal.com/event-types/{EVENT_TYPE_ID}`
   - Kopiere die ID

5. **In .env.local eintragen**:
   ```bash
   NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID=NEUE_ID_HIER
   ```

6. **In Vercel aktualisieren**:
   - Vercel Dashboard → Settings → Environment Variables
   - `NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID` aktualisieren
   - Redeploy

## Option C: Cal.com Team/Collective Event Type

Wenn du mehrere Tutoren hast:

1. **Erstelle ein Team** in Cal.com
2. **Füge alle Tutoren als Team-Mitglieder hinzu**
3. **Erstelle einen "Collective Event Type"**:
   - Alle Tutoren sind verfügbar
   - Round-Robin oder "First Available"
4. **Verwende die Team Event Type ID**

## Testen

Nach dem Fix:

1. **Teste die Buchung**:
   ```
   https://msm-theta.vercel.app/booking
   ```

2. **Prüfe Console Logs**:
   ```javascript
   Cal.com booking created successfully: { id: "...", ... }
   ```

3. **Prüfe Cal.com Dashboard**:
   - Gehe zu **Bookings**
   - Deine Test-Buchung sollte erscheinen

4. **Prüfe Supabase**:
   - Gehe zu Supabase → Table Editor → bookings
   - Buchung sollte mit `calcom_booking_id` erscheinen

## Debugging

Wenn es immer noch nicht funktioniert:

### 1. API Key prüfen
```bash
# In Vercel Logs
CALCOM_API_KEY exists: true
API Key length: 36
```

### 2. Event Type prüfen
```bash
curl -X GET "https://api.cal.com/v1/event-types/3976917?apiKey=YOUR_API_KEY"
```

Antwort sollte zeigen:
```json
{
  "event_type": {
    "id": 3976917,
    "users": [...],  // ← Muss mindestens 1 User haben
    "schedule": {...} // ← Muss Availability haben
  }
}
```

### 3. Availability direkt prüfen
```bash
curl -X GET "https://api.cal.com/v1/availability?eventTypeId=3976917&startTime=2025-01-15T09:00:00Z&endTime=2025-01-15T18:00:00Z&apiKey=YOUR_API_KEY"
```

## Alternative: Custom Booking System

Falls Cal.com zu kompliziert ist, kann ich ein einfacheres System implementieren:

- Buchungen nur in Supabase speichern (kein Cal.com)
- Admin-Dashboard zum Verwalten von Buchungen
- E-Mail-Benachrichtigungen mit Resend API
- Eigenes Availability-System

**Willst du das?** Dann sage Bescheid!

## Support

Falls du Hilfe brauchst:
1. Schicke mir Screenshots vom Cal.com Event Type
2. Zeige mir die Console Logs beim Buchen
3. Ich helfe dir beim Setup
