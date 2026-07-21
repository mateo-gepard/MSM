import { z } from 'zod';
import { PACKAGE_IDS, SUBJECT_IDS, TUTOR_SLUGS } from './catalog';

const trimmedText = (max: number) => z.string().trim().min(1).max(max);

export const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA time zone');

export const startsAtSchema = z.iso.datetime({ offset: true });

export const contactSchema = z.object({
  name: trimmedText(80),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1_000).optional(),
});

export const createBookingSchema = z
  .object({
    tutorSlug: z.enum(TUTOR_SLUGS),
    subjectId: z.enum(SUBJECT_IDS),
    packageId: z.enum(PACKAGE_IDS),
    startsAt: startsAtSchema,
    timeZone: timeZoneSchema.default('Europe/Berlin'),
    location: z.enum(['online', 'in-person']),
    locationVenue: z.string().trim().max(200).optional(),
    contact: contactSchema,
    packagePurchaseId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.location === 'in-person' && !value.locationVenue) {
      context.addIssue({
        code: 'custom',
        path: ['locationVenue'],
        message: 'A venue is required for in-person bookings',
      });
    }
  });

const dateOrDateTimeSchema = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  return z.iso.datetime({ offset: true }).safeParse(value).success;
}, 'Expected an ISO date or ISO date-time');

export const slotsQuerySchema = z
  .object({
    tutorSlug: z.enum(TUTOR_SLUGS),
    start: dateOrDateTimeSchema,
    end: dateOrDateTimeSchema,
    timeZone: timeZoneSchema.default('Europe/Berlin'),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.end) < Date.parse(value.start)) {
      context.addIssue({ code: 'custom', path: ['end'], message: 'End must be after start' });
    }
  });

export const cancelBookingSchema = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .strict();

export const rescheduleBookingSchema = z
  .object({
    startsAt: startsAtSchema,
    timeZone: timeZoneSchema.default('Europe/Berlin'),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const bookingIdSchema = z.uuid();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;

export interface BookingResponse {
  data: {
    booking: {
      id: string;
      tutorSlug: CreateBookingInput['tutorSlug'];
      subjectId: CreateBookingInput['subjectId'];
      packageId: CreateBookingInput['packageId'];
      startsAt: string;
      status: 'scheduled' | 'cancelled' | 'completed';
    };
  };
}

export interface SlotsResponse {
  data: { slots: Array<{ start: string }> };
}

export interface ApiErrorResponse {
  error: { code: string; message: string };
}
