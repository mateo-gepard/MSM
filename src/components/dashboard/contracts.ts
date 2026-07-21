import type {
  BookingListItem,
  BookingListResponse,
  EntitlementListItem,
  EntitlementListResponse,
  ProfileResponse,
} from '@/domain/dashboard-dtos';
import type { BookingStatus } from '@/types/database';

export type BookingDto = BookingListItem;
export type BookingsResponse = BookingListResponse;
export type EntitlementDto = EntitlementListItem;
export type EntitlementsResponse = EntitlementListResponse;
export type ProfileDto = ProfileResponse['data']['profile'];
export type { BookingStatus, ProfileResponse };

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    const apiError = payload as Partial<ApiErrorPayload>;
    throw new Error(apiError.error?.message || fallbackMessage);
  }

  return payload as T;
}
