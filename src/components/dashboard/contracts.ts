import type {
  BookingListItem,
  BookingListResponse,
  EntitlementListItem,
  EntitlementListResponse,
  ProfileResponse,
} from '@/domain/dashboard-dtos';
import type { BookingLifecycleStatus } from '@/types/database';
import type { LearnerListItem } from '@/domain/household-schemas';
import { apiClientError, ClientVisibleError } from '@/lib/api/client-error';

export type BookingDto = BookingListItem;
export type BookingsResponse = BookingListResponse;
export type EntitlementDto = EntitlementListItem;
export type EntitlementsResponse = EntitlementListResponse;
export type ProfileDto = ProfileResponse['data']['profile'];
export type { BookingLifecycleStatus, ProfileResponse };

export interface DashboardData {
  profile: ProfileDto;
  bookings: BookingDto[];
  entitlements: EntitlementDto[];
  learners: LearnerListItem[];
  permissions: {
    canManageLearners: boolean;
    canManageBilling: boolean;
    canBook: boolean;
  };
}

export async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ClientVisibleError(fallbackMessage);
  }

  if (!response.ok) {
    throw apiClientError(payload, fallbackMessage);
  }

  return payload as T;
}
