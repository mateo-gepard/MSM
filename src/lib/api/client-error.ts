const germanApiErrors: Readonly<Record<string, string>> = {
  UNAUTHENTICATED: 'Bitte melde dich an und versuche es erneut.',
  ACCOUNT_INACTIVE: 'Dieser Account ist derzeit nicht aktiv.',
  ROLE_NOT_ALLOWED: 'Dieser Account darf diese Aktion nicht ausführen.',
  MFA_REQUIRED: 'Bitte bestätige die Anmeldung mit deinem zweiten Faktor.',
  MFA_ENROLLMENT_REQUIRED: 'Bitte richte zuerst die Anmeldung mit einem zweiten Faktor ein.',
  RATE_LIMITED: 'Zu viele Anfragen. Bitte warte kurz und versuche es erneut.',
  RATE_LIMIT_UNAVAILABLE: 'Die Anfrage kann gerade nicht sicher verarbeitet werden.',
  DATABASE_UNAVAILABLE: 'Die Daten sind vorübergehend nicht verfügbar.',
  SLOT_CLAIMS_UNAVAILABLE: 'Die Terminverfügbarkeit ist vorübergehend nicht verfügbar.',
  SCHEDULING_PROVIDER_ERROR: 'Der Kalenderdienst ist vorübergehend nicht verfügbar.',
  SLOT_UNAVAILABLE: 'Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen Zeitpunkt.',
  BOOKING_NOT_RESCHEDULABLE: 'Dieser Termin kann nicht umgebucht werden.',
  BOOKING_NOT_CANCELLABLE: 'Dieser Termin kann nicht storniert werden.',
  BOOKING_OPERATION_IN_PROGRESS: 'Für diesen Termin läuft bereits eine Änderung.',
  PAYMENT_REQUIRED: 'Für dieses Paket ist bestätigtes Stundenguthaben erforderlich.',
  NO_CREDITS: 'Für dieses Paket ist kein Stundenguthaben mehr verfügbar.',
  TRIAL_NOT_ALLOWED: 'Die kostenlose Probestunde ist nur für Neukund:innen verfügbar.',
  PAYMENTS_DISABLED: 'Der sichere Paketkauf ist derzeit noch nicht freigeschaltet.',
  OFFER_NOT_AVAILABLE: 'Dieses Paket ist derzeit nicht verfügbar.',
  OFFER_NOT_CONFIGURED: 'Dieses Paket ist noch nicht für den Checkout eingerichtet.',
  ORDER_NOT_PAYABLE: 'Dieser Checkout kann nicht fortgesetzt werden. Bitte starte ihn erneut.',
  LEARNER_REQUIRED: 'Bitte lege einen Lernenden an und wähle ihn für diese Stunde aus.',
  LEARNER_LIMIT_REACHED: 'Dieser Haushalt hat die maximale Zahl von 25 Lernenden erreicht.',
  LEARNER_MANAGEMENT_FORBIDDEN: 'Du darfst die Lernenden in diesem Haushalt nicht bearbeiten.',
  LEARNER_NOT_FOUND: 'Der gewählte Lernende wurde nicht gefunden.',
  EMAIL_MISMATCH: 'Bitte verwende die E Mailadresse deines Accounts.',
  SUBJECT_NOT_OFFERED: 'Der gewählte Tutor bietet dieses Fach nicht an.',
  LOCATION_NOT_OFFERED: 'Der gewählte Tutor bietet dieses Unterrichtsformat nicht an.',
  CHAT_NOT_ALLOWED: 'Diese Unterhaltung ist für deinen Account nicht freigegeben.',
  TUTOR_ACCOUNT_UNAVAILABLE: 'Das Chatkonto dieses Tutors ist derzeit nicht verfügbar.',
  CHAT_IDEMPOTENCY_REUSED: 'Diese Nachricht kann nicht mit derselben Kennung geändert werden.',
};

export class ClientVisibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientVisibleError';
  }
}

export function germanApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return fallback;
  const error = payload.error;
  if (!error || typeof error !== 'object' || !('code' in error)) return fallback;
  return typeof error.code === 'string' ? germanApiErrors[error.code] ?? fallback : fallback;
}

export function apiClientError(payload: unknown, fallback: string): ClientVisibleError {
  return new ClientVisibleError(germanApiErrorMessage(payload, fallback));
}

export function clientErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ClientVisibleError ? error.message : fallback;
}
