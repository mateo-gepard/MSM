import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTutorBySlug, isTutorSlug } from '@/domain/catalog';
import { TutorDashboard } from '@/components/tutor/TutorDashboard';

interface TutorDashboardPageProps {
  params: Promise<{ tutorId: string }>;
}

export async function generateMetadata({ params }: TutorDashboardPageProps): Promise<Metadata> {
  const { tutorId } = await params;
  if (!isTutorSlug(tutorId)) return { title: 'Tutor-Dashboard' };
  return { title: `Tutor-Dashboard – ${getTutorBySlug(tutorId).name}` };
}

export default async function TutorDashboardPage({ params }: TutorDashboardPageProps) {
  const { tutorId } = await params;
  if (!isTutorSlug(tutorId)) notFound();
  return <TutorDashboard tutorSlug={tutorId} />;
}
