import { describe, expect, it } from 'vitest';
import { createLearnerSchema, updateLearnerSchema } from './household-schemas';

describe('learner schemas', () => {
  it('normalizes a learner and permits an optional birth date', () => {
    expect(createLearnerSchema.parse({ displayName: '  Lina  ', birthDate: '2012-03-04' })).toEqual({
      displayName: 'Lina',
      birthDate: '2012-03-04',
    });
  });

  it('rejects future birth dates and untrusted household ownership fields', () => {
    expect(createLearnerSchema.safeParse({ displayName: 'Lina', birthDate: '2999-01-01' }).success).toBe(false);
    expect(createLearnerSchema.safeParse({ displayName: 'Lina', householdId: crypto.randomUUID() }).success).toBe(false);
  });

  it('requires at least one update field', () => {
    expect(updateLearnerSchema.safeParse({}).success).toBe(false);
    expect(updateLearnerSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateLearnerSchema.safeParse({ birthDate: '2999-01-01' }).success).toBe(false);
  });
});
