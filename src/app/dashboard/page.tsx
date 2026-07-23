import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';
import { getTutorByDbId } from '@/domain/catalog';
import { ApiError } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';
import {
  getBookingListForPrincipal,
  getEntitlementsForPrincipal,
  getLearnersForPrincipal,
} from '@/lib/dashboard/server';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Verwalte deine MSM Termine, Unterrichtsguthaben und Nachrichten.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let principal;
  try {
    principal = await requireActivePrincipal();
    await requireStaffMfa(principal);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      if (
        error.code === 'MFA_REQUIRED' ||
        error.code === 'MFA_ENROLLMENT_REQUIRED'
      ) {
        redirect('/mfa?redirect=/dashboard');
      }
      redirect('/login?redirect=/dashboard');
    }
    throw error;
  }

  if (!principal.roles.includes('parent') && principal.roles.includes('tutor')) {
    const tutorSlug = principal.tutorId ? getTutorByDbId(principal.tutorId)?.slug : null;
    redirect(tutorSlug ? `/tutor-dashboard/${tutorSlug}` : '/tutor-login');
  }
  if (!principal.roles.includes('parent') && principal.roles.includes('admin')) {
    redirect('/tutor-login');
  }

  if (!principal.householdId) redirect('/login?redirect=/dashboard');

  const [bookings, entitlements, learners] = await Promise.all([
    getBookingListForPrincipal(principal),
    getEntitlementsForPrincipal(principal),
    getLearnersForPrincipal(principal),
  ]);

  return (
    <ParentDashboard
      initialData={{
        profile: {
          role: 'parent',
          roles: [...principal.roles],
          tutorSlug: null,
          displayName: principal.displayName,
        },
        bookings,
        entitlements,
        learners,
        permissions: {
          canManageLearners: principal.householdPermissions?.canManageLearners ?? false,
          canManageBilling: principal.householdPermissions?.canManageBilling ?? false,
          canBook: principal.householdPermissions?.canBook ?? false,
        },
      }}
    />
  );
}
