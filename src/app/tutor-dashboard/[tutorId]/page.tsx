import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTutorBySlug, isTutorSlug } from '@/domain/catalog';
import { TutorDashboard } from '@/components/tutor/TutorDashboard';
import { ApiError } from '@/lib/api/errors';
import { requireActivePrincipal, requireStaffMfa } from '@/lib/auth/server';

interface TutorDashboardPageProps {
  params: Promise<{ tutorId: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: TutorDashboardPageProps): Promise<Metadata> {
  const { tutorId } = await params;
  if (!isTutorSlug(tutorId)) return { title: 'Tutordashboard' };
  return { title: `Tutordashboard von ${getTutorBySlug(tutorId).name}` };
}

export default async function TutorDashboardPage({ params }: TutorDashboardPageProps) {
  const { tutorId } = await params;
  if (!isTutorSlug(tutorId)) notFound();
  let principal;
  try {
    principal = await requireActivePrincipal(['tutor', 'admin']);
    await requireStaffMfa(principal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?redirect=${encodeURIComponent(`/tutor-dashboard/${tutorId}`)}`);
    }
    if (
      error instanceof ApiError &&
      (error.code === 'MFA_REQUIRED' || error.code === 'MFA_ENROLLMENT_REQUIRED')
    ) {
      redirect(`/mfa?redirect=${encodeURIComponent(`/tutor-dashboard/${tutorId}`)}`);
    }
    if (error instanceof ApiError && error.status === 403) notFound();
    throw error;
  }

  const tutor = getTutorBySlug(tutorId);
  if (
    principal.roles.includes('tutor') &&
    !principal.roles.includes('admin') &&
    principal.tutorId !== tutor.dbId
  ) {
    notFound();
  }
  return <TutorDashboard tutorSlug={tutorId} />;
}
