import { ReactNode } from 'react';
import { SendbirdProvider } from "@/contexts/SendbirdContext";

export default function TutorDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // No navigation or footer for tutor dashboard - it has its own header
  return (
    <SendbirdProvider>
      <div className="tutor-dashboard-container">
        {children}
      </div>
    </SendbirdProvider>
  );
}
