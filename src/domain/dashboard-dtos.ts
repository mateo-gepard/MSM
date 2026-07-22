import type { PackageId, SubjectId, TutorSlug } from './catalog';
import type { BookingLifecycleStatus, BookingSyncStatus, PurchaseStatus, UserRole } from '@/types/database';

export interface BookingListItem {
  id: string;
  learner: { id: string; displayName: string };
  tutor: { slug: TutorSlug; name: string };
  subject: { id: SubjectId; name: string };
  package: { id: PackageId; name: string };
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  location: 'online' | 'in-person';
  locationVenue: string | null;
  meetingUrl: string | null;
  status: BookingLifecycleStatus;
  syncStatus: BookingSyncStatus;
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
      roles: UserRole[];
      tutorSlug: TutorSlug | null;
      displayName: string | null;
    };
  };
}
