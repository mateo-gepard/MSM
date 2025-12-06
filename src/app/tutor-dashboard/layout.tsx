import { ReactNode } from 'react';

export default function TutorDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // No navigation or footer for tutor dashboard - it has its own header
  return <>{children}</>;
}
