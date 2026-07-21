import type { Metadata } from 'next';
import { BookingFlow, type BookingInitialState } from './BookingFlow';
import { isPackageId, isSubjectId, isTutorSlug } from '@/domain/catalog';

export const metadata: Metadata = {
  title: 'Termin buchen | MSM',
  description:
    'Wähle Mentor, Unterrichtsformat und einen live verfügbaren Termin für dein 1:1 Mentoring.',
};

interface BookingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const params = await searchParams;
  const tutor = first(params.tutor);
  const subject = first(params.subject);
  const selectedPackage = first(params.package);
  const startsAt = first(params.startsAt);
  const location = first(params.location);
  const venue = first(params.venue);
  const reschedule = first(params.reschedule);
  const requestedStage = first(params.step);

  const initial: BookingInitialState = {
    tutorSlug: tutor && isTutorSlug(tutor) ? tutor : undefined,
    subjectId: subject && isSubjectId(subject) ? subject : undefined,
    packageId: selectedPackage && isPackageId(selectedPackage) ? selectedPackage : undefined,
    startsAt: startsAt && !Number.isNaN(Date.parse(startsAt)) ? startsAt : undefined,
    location: location === 'in-person' ? 'in-person' : 'online',
    locationVenue:
      venue === 'student-home' || venue === 'public-place' ? venue : undefined,
    rescheduleId:
      reschedule && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(reschedule)
        ? reschedule
        : undefined,
    stage:
      requestedStage === 'review' || requestedStage === 'time' || requestedStage === 'details'
        ? requestedStage
        : undefined,
  };

  return <BookingFlow initial={initial} />;
}
