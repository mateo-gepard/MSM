import type { Metadata } from 'next';
import MatchingWizard from './MatchingWizard';

export const metadata: Metadata = {
  title: 'Passenden Tutor finden',
  description:
    'Finde in drei kurzen Schritten einen fachlich passenden Mentor für deinen Lernweg.',
};

export default function Page() {
  return <MatchingWizard />;
}
