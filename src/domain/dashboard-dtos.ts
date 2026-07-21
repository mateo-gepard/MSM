import type { PackageId, SubjectId, TutorSlug } from './catalog';
import type { BookingStatus, PurchaseStatus, UserRole } from '@/types/database';

export interface BookingListItem {
  id: string;
  tutor: { slug: TutorSlug; name: string };
  subject: { id: SubjectId; name: string };
  package: { id: PackageId; name: string };
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  location: 'online' | 'in-person';
  locationVenue: string | null;
  status: BookingStatus;
  contact: {
    name: string;
    email: string;
    phone: string | null;
    message: string | null;
  };
}

export interface BookingListResponse {
  data: { bookings: BookingListItem[] };
}

export interface EntitlementListItem {
  id: string;
  package: { id: PackageId; name: string; sessions: number };
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: PurchaseStatus;
  paymentStatus: 'verified';
  createdAt: string;
}

export interface EntitlementListResponse {
  data: { entitlements: EntitlementListItem[] };
}

export interface ProfileResponse {
  data: {
    profile: {
      role: UserRole;
      tutorSlug: TutorSlug | null;
      displayName: string | null;
    };
  };
}
