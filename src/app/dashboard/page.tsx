import type { Metadata } from 'next';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Verwalte deine MSM Termine, Unterrichtsguthaben und Nachrichten.',
};

export default function DashboardPage() {
  return <ParentDashboard />;
}
