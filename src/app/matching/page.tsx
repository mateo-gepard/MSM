import { Suspense } from 'react';
import MatchingWizard from './MatchingWizard';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 flex items-center justify-center"><div className="text-white">Laden...</div></div>}>
      <MatchingWizard />
    </Suspense>
  );
}
