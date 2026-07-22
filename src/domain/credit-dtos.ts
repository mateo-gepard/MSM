import type { PackageId } from './catalog';

export interface CreditBalance {
  packageId: Exclude<PackageId, 'trial'>;
  remainingSessions: number;
}

export interface CreditBalanceResponse {
  data: { credits: CreditBalance[] };
}
