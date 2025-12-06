'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Check, AlertCircle, RefreshCw } from 'lucide-react';

export default function MigrateBookings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const migrateBookings = async () => {
    if (!user) {
      setStatus('error');
      setMessage('You must be logged in to migrate bookings');
      return;
    }

    setStatus('migrating');
    setMessage('Migrating bookings...');

    try {
      // Get user's bookings from localStorage
      const userBookingsKey = `userBookings_${user.id}`;
      const userBookings = JSON.parse(localStorage.getItem(userBookingsKey) || '[]');

      if (userBookings.length === 0) {
        setStatus('error');
        setMessage('No bookings found to migrate');
        return;
      }

      // Get or create allTutorBookings object
      const allTutorBookings = JSON.parse(localStorage.getItem('allTutorBookings') || '{}');

      let migratedCount = 0;

      // Process each booking
      for (const booking of userBookings) {
        // Extract tutor ID from tutorName or use a mapping
        const tutorNameToId: Record<string, string> = {
          'Juan Rivera Chopinaud': '1',
          'Roman Daugavet': '2',
          'Len Sobol': '3',
          'Mateo Mamaladze': '4',
          'Johannes Jacob': '5',
          'Sophie Weber': '2', // Sophie doesn't exist, map to Roman as fallback
        };

        const tutorId = tutorNameToId[booking.tutorName] || '1';

        // Create tutor booking entry
        const tutorBooking = {
          id: booking.calcomBookingId || booking.id,
          parentName: booking.contact?.name || user.user_metadata?.name || user.email || 'Elternteil',
          parentEmail: booking.contact?.email || user.email || '',
          parentId: user.id, // Add the Supabase user ID
          subject: booking.subject,
          date: booking.date,
          time: booking.time,
          location: booking.location,
          status: booking.status,
          message: booking.contact?.message,
          createdAt: booking.createdAt || new Date().toISOString()
        };

        // Add to tutor's bookings
        if (!allTutorBookings[tutorId]) {
          allTutorBookings[tutorId] = [];
        }

        // Check if booking already exists
        const exists = allTutorBookings[tutorId].some(
          (b: any) => b.id === tutorBooking.id
        );

        if (!exists) {
          allTutorBookings[tutorId].push(tutorBooking);
          migratedCount++;
        }
      }

      // Save updated allTutorBookings
      localStorage.setItem('allTutorBookings', JSON.stringify(allTutorBookings));

      setStatus('success');
      setMessage(`Successfully migrated ${migratedCount} booking(s)! You can now use the tutor dashboard.`);
    } catch (error) {
      console.error('Migration error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Migration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center p-4">
      <FrostedCard className="max-w-2xl w-full p-8">
        <h1 className="text-3xl font-bold text-white mb-4">Migrate Bookings</h1>
        <p className="text-gray-300 mb-6">
          This utility will copy your existing bookings to the tutor dashboard format,
          adding the necessary <code className="bg-secondary-dark px-2 py-1 rounded">parentId</code> field
          so tutors can see and respond to your messages.
        </p>

        {status === 'idle' && (
          <Button onClick={migrateBookings} className="w-full">
            <RefreshCw className="w-5 h-5 mr-2" />
            Migrate My Bookings
          </Button>
        )}

        {status === 'migrating' && (
          <div className="flex items-center justify-center gap-3 text-white">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>{message}</span>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-400 font-semibold mb-1">Migration Complete!</p>
              <p className="text-green-300 text-sm">{message}</p>
              <p className="text-green-300 text-sm mt-2">
                You can now go to <a href="/tutor-dashboard/1" className="underline">/tutor-dashboard/1</a> (Juan) 
                or <a href="/tutor-dashboard/2" className="underline">/tutor-dashboard/2</a> (Roman) 
                to see your bookings and chat.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold mb-1">Migration Failed</p>
              <p className="text-red-300 text-sm">{message}</p>
              <Button onClick={() => setStatus('idle')} className="mt-3">
                Try Again
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10">
          <h2 className="text-lg font-semibold text-white mb-2">Debug Info</h2>
          <div className="bg-secondary-dark rounded-lg p-4 text-sm text-gray-300 font-mono">
            <p>User ID: {user?.id || 'Not logged in'}</p>
            <p>Email: {user?.email || 'N/A'}</p>
            <p className="mt-2">Run in console to check bookings:</p>
            <code className="block bg-primary-dark p-2 rounded mt-1 text-xs overflow-x-auto">
              JSON.parse(localStorage.getItem('userBookings_{user?.id}') || '[]')
            </code>
          </div>
        </div>
      </FrostedCard>
    </div>
  );
}
