import { z } from 'zod';

export const PAID_PACKAGE_IDS = ['medium', 'small', 'single'] as const;

export const checkoutSessionSchema = z
  .object({
    packageId: z.enum(PAID_PACKAGE_IDS),
    idempotencyKey: z.uuid(),
  })
  .strict();

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

export interface CheckoutSessionResponse {
  data: {
    orderId: string;
    checkoutUrl: string;
  };
}
