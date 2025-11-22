# Cal.com Setup Guide

## Problem: "no_available_users_found_error"

Dieser Fehler bedeutet, dass Cal.com keinen verfügbaren Benutzer für den gewählten Event Type findet.

## Lösungsschritte:

### 1. Überprüfe deine Event Type ID

1. Gehe zu https://app.cal.com/event-types
2. Klicke auf deinen Event Type ("Eine Stunde - Online")
3. Die URL sollte so aussehen: `https://app.cal.com/event-types/XXXXXXX`
4. Die Zahl `XXXXXXX` ist deine Event Type ID
5. Aktualisiere `.env.local` mit der korrekten ID:
   ```
   NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID=XXXXXXX
   ```

### 2. Stelle sicher, dass der Event Type aktiv ist

- In den Event Type Einstellungen, stelle sicher dass:
  - ✅ Der Event Type **nicht deaktiviert** ist
  - ✅ **Verfügbarkeitszeiten** sind gesetzt (z.B. Mo-Fr 9:00-18:00)
  - ✅ Der Event Type ist **öffentlich** oder für API-Buchungen freigegeben

### 3. Überprüfe die Verfügbarkeit

- Gehe zu deinen **Availability Settings**: https://app.cal.com/availability
- Stelle sicher, dass du Verfügbarkeitszeiten gesetzt hast
- Beispiel:
  - Montag-Freitag: 09:00 - 18:00
  - Samstag: 10:00 - 14:00

### 4. Alternative: Benutze Mock-Modus für Entwicklung

Wenn du Cal.com noch nicht vollständig konfiguriert hast, kannst du vorübergehend den Mock-Modus verwenden:

In `src/app/booking/page.tsx`, ändere Zeile 195 von:
```typescript
const bookingResult = await createBooking({
```

Zu:
```typescript
const bookingResult = await mockCreateBooking({
```

**Wichtig:** Vergiss nicht, dies wieder zu `createBooking` zu ändern, wenn Cal.com konfiguriert ist!

### 5. Teste die API mit curl

Teste deine Cal.com API direkt:

```bash
curl -X POST "https://api.cal.com/v1/bookings?apiKey=cal_live_579ad0501bd4f24c7c34d77acb4ef28d" \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypeId": 3976917,
    "start": "2025-11-29T14:00:00",
    "timeZone": "Europe/Berlin",
    "language": "de",
    "responses": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }'
```

Wenn das einen Fehler gibt, liegt das Problem bei der Cal.com Konfiguration, nicht bei deinem Code.

## Häufige Probleme

### "no_available_users_found_error"
- **Ursache**: Event Type hat keine Verfügbarkeit oder ist deaktiviert
- **Lösung**: Überprüfe Availability Settings in Cal.com

### "invalid_type in 'timeZone': Required"
- **Ursache**: timeZone fehlt im Request
- **Lösung**: Bereits behoben in unserem Code (Standard: "Europe/Berlin")

### "Unauthorized" oder "No apiKey provided"
- **Ursache**: API Key ist ungültig oder fehlt
- **Lösung**: Überprüfe `.env.local` und starte den Server neu

## Support

Wenn das Problem weiterhin besteht, kontaktiere Cal.com Support oder checke deren API Dokumentation:
- https://cal.com/docs/api-reference
- https://app.cal.com/settings/developer/api-keys
