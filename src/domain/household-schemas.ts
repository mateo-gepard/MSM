import { z } from 'zod';

const learnerFields = {
  displayName: z.string().trim().min(2).max(80),
  birthDate: z.iso.date().optional(),
};

export const createLearnerSchema = z.object(learnerFields).strict().superRefine((value, context) => {
  if (value.birthDate && Date.parse(`${value.birthDate}T00:00:00Z`) > Date.now()) {
    context.addIssue({ code: 'custom', path: ['birthDate'], message: 'Birth date cannot be in the future' });
  }
});

export const updateLearnerSchema = z
  .object({
    displayName: learnerFields.displayName.optional(),
    birthDate: z.union([z.iso.date(), z.null()]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'At least one field is required' });
    }
    if (
      value.birthDate &&
      Date.parse(`${value.birthDate}T00:00:00Z`) > Date.now()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'Birth date cannot be in the future',
      });
    }
  });

export const learnerIdSchema = z.uuid();

export interface LearnerListItem {
  id: string;
  displayName: string;
  birthDate: string | null;
  isActive: boolean;
  isLegacyPlaceholder: boolean;
}

export interface LearnerListResponse {
  data: { learners: LearnerListItem[] };
}
