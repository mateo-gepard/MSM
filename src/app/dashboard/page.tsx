'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { cancelBooking } from '@/lib/calcom';
import { getUserBookings, supabase } from '@/lib/supabase';
import { tutors } from '@/data/mockData';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import ChatWidget from '@/components/chat/ChatWidget';
import { SendbirdProvider } from '@/contexts/SendbirdContext';
import { 
  Calendar,
  MessageCircle,
  BookOpen,
  User,
  Settings,
  Plus,
  Check,
  X,
  Clock,
  Loader2,
  Monitor,
  Home,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock data
const mockBookings = [
  {
    id: '1',
    tutorName: 'Alexander Schmidt',
    subject: 'Mathematik',
    date: '2025-11-25',
    time: '14:00',
    duration: 60,
    status: 'scheduled' as const,
    location: 'online' as const
  },
  {
    id: '2',
    tutorName: 'Sophie Weber',
    subject: 'Chemie',
    date: '2025-11-23',
    time: '16:00',
    duration: 60,
    status: 'completed' as const,
    location: 'in-person' as const
  },
  {
    id: '3',
    tutorName: 'Maximilian Hoffmann',
    subject: 'Informatik',
    date: '2025-12-01',
    time: '15:00',
    duration: 60,
    status: 'scheduled' as const,
    location: 'online' as const
  }
];

const mockMessages = [
  {
    id: '1',
    from: 'Alexander Schmidt',
    subject: 'Mathematik',
    message: 'Hallo! Ich habe die Übungsaufgaben für die nächste Stunde vorbereitet.',
    time: '2025-11-22 10:30',
    unread: true
  },
  {
    id: '2',
    from: 'Sophie Weber',
    subject: 'Chemie',
    message: 'Danke für die tolle Stunde! Hier sind noch einige Links zum Thema.',
    time: '2025-11-21 18:00',
    unread: false
  }
];

// Messages Interface Component with Tutor List and Chat
function MessagesInterface({ userBookings, userId }: { userBookings: any[], userId: string }) {
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  
  // Get unique tutors from bookings
  const uniqueTutors = Array.from(new Set(userBookings.map(b => b.tutorId)))
    .map(tutorId => {
      const booking = userBookings.find(b => b.tutorId === tutorId);
      return booking ? {
        tutorId,
        tutorName: booking.tutorName,
        subject: booking.subject
      } : null;
    })
    .filter(Boolean);

  // Auto-select first tutor if none selected
  useEffect(() => {
    if (uniqueTutors.length > 0 && !selectedTutorId) {
      setSelectedTutorId(uniqueTutors[0]!.tutorId);
    }
  }, [uniqueTutors, selectedTutorId]);

  const selectedTutor = uniqueTutors.find(t => t?.tutorId === selectedTutorId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[600px]">
      {/* Tutor List Sidebar */}
      <div className="md:col-span-1 bg-secondary-dark/50 rounded-xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Deine Tutoren</h3>
          <p className="text-xs text-gray-400 mt-1">{uniqueTutors.length} {uniqueTutors.length === 1 ? 'Tutor' : 'Tutoren'}</p>
        </div>
        <div className="overflow-y-auto h-[calc(600px-80px)]">
          {uniqueTutors.map((tutor) => {
            if (!tutor) return null;
            const isSelected = selectedTutorId === tutor.tutorId;
            
            return (
              <button
                key={tutor.tutorId}
                onClick={() => setSelectedTutorId(tutor.tutorId)}
                className={`w-full p-4 text-left transition-all border-b border-white/5 hover:bg-primary-dark/50 ${
                  isSelected ? 'bg-primary-dark/70 border-l-4 border-l-accent' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    isSelected ? 'bg-accent text-white' : 'bg-secondary-dark text-gray-400'
                  }`}>
                    {tutor.tutorName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {tutor.tutorName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{tutor.subject}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Window */}
      <div className="md:col-span-3 bg-secondary-dark/50 rounded-xl overflow-hidden border border-white/10">
        {selectedTutor ? (
          <div className="h-full">
            <ChatWidget
              tutorId={selectedTutor.tutorId}
              tutorName={selectedTutor.tutorName}
              parentId={userId}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Wähle einen Tutor aus, um zu chatten</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const bookingSuccess = searchParams.get('bookingSuccess');
  const rescheduleSuccess = searchParams.get('rescheduleSuccess');
  const [activeTab, setActiveTab] = useState<'bookings' | 'messages' | 'calendar' | 'profile'>('bookings');
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [bookingFilter, setBookingFilter] = useState<'scheduled' | 'completed' | 'cancelled' | 'all'>('scheduled');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);

  // Load user bookings from Supabase (with fallback to localStorage)
  useEffect(() => {
    const loadBookings = async () => {
      if (user?.id) {
        try {
          // Try to load from Supabase first
          const supabaseBookings = await getUserBookings(user.id);
          if (supabaseBookings && supabaseBookings.length > 0) {
            console.log('Loaded bookings from Supabase:', supabaseBookings);
            
            // Convert Supabase format to localStorage format
            const convertedBookings = supabaseBookings.map((booking: any) => {
              // Try to get tutor name from Supabase, fallback to finding by ID
              let tutorName = booking.tutor_name;
              
              if (!tutorName && booking.tutor_id) {
                const tutor = tutors.find(t => t.id === booking.tutor_id);
                tutorName = tutor?.name || 'Tutor nicht gefunden';
              }
              
              if (!tutorName) {
                tutorName = 'Tutor nicht angegeben';
              }
              
              return {
                id: booking.id,
                calcomBookingId: booking.calcom_booking_id,
                tutorId: booking.tutor_id,
                tutorName: tutorName,
                subject: booking.subject,
                packageId: booking.package,
                packageName: booking.package,
                date: booking.date,
                time: booking.time,
                location: booking.location,
                contact: {
                  name: booking.contact_name,
                  email: booking.contact_email,
                  phone: booking.contact_phone,
                  message: booking.message
                },
                status: booking.status,
                createdAt: booking.created_at,
                updatedAt: booking.updated_at
              };
            });
            
            console.log('Converted bookings:', convertedBookings);
            setUserBookings(convertedBookings);
            
            // Also sync to localStorage for offline access
            const storageKey = `userBookings_${user.id}`;
            localStorage.setItem(storageKey, JSON.stringify(convertedBookings));
            
            return;
          }
        } catch (error) {
          console.error('Failed to load bookings from Supabase:', error);
        }
      }
      
      // Fallback to localStorage (user-specific)
      if (user?.id) {
        const storageKey = `userBookings_${user.id}`;
        const storedBookings = localStorage.getItem(storageKey);
        if (storedBookings) {
          try {
            const bookings = JSON.parse(storedBookings);
            console.log('Loaded user bookings from localStorage:', bookings);
            setUserBookings(bookings);
          } catch (error) {
            console.error('Failed to load bookings from localStorage:', error);
          }
        }
      }
    };
    
    loadBookings();
  }, [user]);

  // Load user name from metadata and check if user needs to set password
  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.name || '';
      setUserName(name);
      
      // Check if user should see password prompt
      const hasDismissed = localStorage.getItem(`passwordPromptDismissed_${user.id}`);
      const hasSetPassword = localStorage.getItem(`passwordSet_${user.id}`);
      
      // Hide if dismissed or password was set locally
      if (hasDismissed || hasSetPassword) {
        setShowPasswordPrompt(false);
        return;
      }
      
      // Check has_password flag: true = has password, false = no password, undefined = unknown
      const hasPasswordFlag = user.user_metadata?.has_password;
      
      // Show banner only if user explicitly has no password (false)
      if (hasPasswordFlag === false) {
        setHasPassword(false);
        setShowPasswordPrompt(true);
      } else {
        setShowPasswordPrompt(false);
      }
    }
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const dismissPasswordPrompt = () => {
    if (user?.id) {
      localStorage.setItem(`passwordPromptDismissed_${user.id}`, 'true');
      setShowPasswordPrompt(false);
    }
  };

  // Umbuchen - redirect to booking page with pre-filled data
  const handleReschedule = (booking: any) => {
    // Store the booking ID to reschedule
    localStorage.setItem('rescheduleBookingId', booking.id);
    // Redirect to booking page
    router.push(`/booking?reschedule=${booking.id}`);
  };

  // Stornieren - show confirmation modal
  const handleCancelClick = (booking: any) => {
    setBookingToCancel(booking);
    setShowCancelModal(true);
    setCancelError(null);
  };

  // Confirm cancellation with Cal.com API
  const confirmCancellation = async () => {
    if (!bookingToCancel) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      console.log('🚫 Starting cancellation process for:', bookingToCancel.id);

      // Get the actual Cal.com booking ID - prefer calcomBookingId field
      let calcomIdToUse = bookingToCancel.calcomBookingId || bookingToCancel.id;
      
      // Check if this is a local-only booking (starts with 'booking_' or 'mock-')
      const isLocalBooking = String(calcomIdToUse).startsWith('booking_') || String(calcomIdToUse).startsWith('mock-');
      
      console.log('📋 Booking details:', {
        localId: bookingToCancel.id,
        calcomBookingId: bookingToCancel.calcomBookingId,
        calcomIdToUse: calcomIdToUse,
        isLocalBooking: isLocalBooking
      });

      let result = null;

      // Try to cancel in Cal.com (if it's not a local-only booking)
      if (!isLocalBooking) {
        try {
          result = await cancelBooking(String(calcomIdToUse), 'User requested cancellation');
          console.log('✅ Cancellation result:', result);
        } catch (error) {
          console.warn('⚠️ Cal.com cancellation failed, continuing with local cancellation:', error);
        }
      } else {
        console.log('ℹ️ Local booking only, skipping Cal.com API call');
      }

      // Update local state (always succeed locally)
      const updatedBookings = userBookings.map(b => 
        b.id === bookingToCancel.id 
          ? { ...b, status: 'cancelled' }
          : b
      );

      // Save to localStorage
      if (user?.id) {
        const storageKey = `userBookings_${user.id}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedBookings));
        console.log('💾 Local storage updated');
      }
      
      // Update React state
      setUserBookings(updatedBookings);
      
      // Close modal
      setShowCancelModal(false);
      setBookingToCancel(null);
      
      console.log('✅ Cancellation completed successfully');

      // Show info message if Cal.com sync failed
      if (result?.localOnly && result?.calcomError) {
        console.log('ℹ️ Cal.com sync failed but local cancellation succeeded');
      }

    } catch (error) {
      console.error('❌ Cancellation process failed:', error);
      setCancelError(error instanceof Error ? error.message : 'Stornierung fehlgeschlagen');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSaveName = async () => {
    if (!user || !userName.trim()) return;

    setIsSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: userName.trim() }
      });

      if (error) throw error;

      setIsEditingName(false);
      alert('Name erfolgreich gespeichert!');
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Fehler beim Speichern des Namens. Bitte versuche es erneut.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-20 flex items-center justify-center">
        <div className="text-white text-xl">Lädt...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center">
        <div className="bg-secondary-dark/80 p-8 rounded-xl shadow-xl text-center">
          <User className="w-10 h-10 mx-auto mb-4 text-accent" />
          <h2 className="text-2xl font-bold text-white mb-2">Login erforderlich</h2>
          <p className="text-gray-300 mb-4">Bitte melde dich an, um dein Dashboard zu sehen.</p>
          <a href="/login" className="inline-block px-6 py-2 bg-accent text-white rounded-lg font-semibold hover:bg-accent/80 transition">Zum Login</a>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'bookings', label: 'Buchungen', icon: BookOpen, badge: userBookings.length },
    { id: 'messages', label: 'Nachrichten', icon: MessageCircle, badge: mockMessages.filter(m => m.unread).length },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'profile', label: 'Profil', icon: User }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'completed': return <Check className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Geplant';
      case 'completed': return 'Abgeschlossen';
      case 'cancelled': return 'Storniert';
      default: return status;
    }
  };

  return (
    <SendbirdProvider>
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Success Message */}
          {bookingSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 flex items-center gap-3"
          >
            <Check className="w-5 h-5" />
            <span>Buchung erfolgreich! Du erhältst in Kürze eine Bestätigung per E-Mail.</span>
          </motion.div>
        )}
        
        {/* Reschedule Success Message */}
        {rescheduleSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 flex items-center gap-3"
          >
            <Check className="w-5 h-5" />
            <span>Buchung erfolgreich umgebucht! Die Änderungen wurden gespeichert.</span>
          </motion.div>
        )}

        {/* Password Prompt Banner */}
        {showPasswordPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-6 bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/50 rounded-xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">
                  Sichere deinen Account mit einem Passwort
                </h3>
                <p className="text-gray-300 mb-4">
                  Du hast dich per Magic Link eingeloggt. Das ist praktisch, aber für mehr Sicherheit und schnelleren Zugriff 
                  empfehlen wir dir, ein Passwort zu setzen. So kannst du dich auch ohne E-Mail-Link einloggen.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/reset-password">
                    <Button size="sm" variant="primary">
                      <KeyRound className="w-4 h-4 mr-2" />
                      Passwort jetzt setzen
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={dismissPasswordPrompt}
                  >
                    Später erinnern
                  </Button>
                </div>
              </div>
              <button
                onClick={dismissPasswordPrompt}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Verwalte deine Buchungen, Nachrichten und Profile</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <FrostedCard className="p-4" hover={false}>
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-accent text-white'
                        : 'text-gray-400 hover:bg-secondary-dark hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="flex-1 text-left font-medium">{tab.label}</span>
                    {tab.badge && tab.badge > 0 && (
                      <span className="px-2 py-0.5 bg-accent rounded-full text-xs font-bold">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="mt-6 pt-6 border-t border-white/10">
                <Link href="/booking">
                  <Button size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Neue Buchung
                  </Button>
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-secondary-dark hover:text-white transition-all">
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Einstellungen</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                >
                  <X className="w-5 h-5" />
                  <span className="font-medium">Abmelden</span>
                </button>
              </div>
            </FrostedCard>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <FrostedCard className="p-6" hover={false}>
              {/* Bookings Tab */}
              {activeTab === 'bookings' && (
                <div>
                  {userBookings.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <h2 className="text-2xl font-bold text-white">Meine Buchungen</h2>
                      <Link href="/booking">
                        <Button size="sm" className="flex items-center">
                          <Plus className="w-4 h-4 mr-2" />
                          Neue Buchung
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Filter Buttons */}
                  {userBookings.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      <button
                        onClick={() => setBookingFilter('scheduled')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          bookingFilter === 'scheduled'
                            ? 'bg-accent text-white'
                            : 'bg-secondary-dark/50 text-gray-400 hover:bg-secondary-dark'
                        }`}
                      >
                        Anstehend ({userBookings.filter(b => b.status === 'scheduled').length})
                      </button>
                      <button
                        onClick={() => setBookingFilter('completed')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          bookingFilter === 'completed'
                            ? 'bg-accent text-white'
                            : 'bg-secondary-dark/50 text-gray-400 hover:bg-secondary-dark'
                        }`}
                      >
                        Abgeschlossen ({userBookings.filter(b => b.status === 'completed').length})
                      </button>
                      <button
                        onClick={() => setBookingFilter('cancelled')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          bookingFilter === 'cancelled'
                            ? 'bg-accent text-white'
                            : 'bg-secondary-dark/50 text-gray-400 hover:bg-secondary-dark'
                        }`}
                      >
                        Storniert ({userBookings.filter(b => b.status === 'cancelled').length})
                      </button>
                      <button
                        onClick={() => setBookingFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          bookingFilter === 'all'
                            ? 'bg-accent text-white'
                            : 'bg-secondary-dark/50 text-gray-400 hover:bg-secondary-dark'
                        }`}
                      >
                        Alle ({userBookings.length})
                      </button>
                    </div>
                  )}

                  {userBookings.length === 0 ? (
                    <div className="p-12 bg-secondary-dark/30 rounded-xl text-center">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                      <h3 className="text-xl font-bold text-white mb-2">Noch keine Buchungen</h3>
                      <p className="text-gray-400 mb-6">
                        Starte deine Lernreise und buche deinen ersten Tutor!
                      </p>
                      <Link href="/matching">
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Jetzt Tutor finden
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      {userBookings.filter(booking => bookingFilter === 'all' || booking.status === bookingFilter).length === 0 ? (
                        <div className="p-12 bg-secondary-dark/30 rounded-xl text-center">
                          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                          <h3 className="text-xl font-bold text-white mb-2">
                            Keine {bookingFilter === 'scheduled' ? 'anstehenden' : bookingFilter === 'completed' ? 'abgeschlossenen' : 'stornierten'} Buchungen
                          </h3>
                          <p className="text-gray-400">
                            {bookingFilter === 'scheduled' && 'Du hast aktuell keine anstehenden Termine.'}
                            {bookingFilter === 'completed' && 'Du hast noch keine abgeschlossenen Termine.'}
                            {bookingFilter === 'cancelled' && 'Du hast keine stornierten Termine.'}
                            {bookingFilter === 'all' && 'Keine Buchungen vorhanden.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {userBookings
                            .filter(booking => bookingFilter === 'all' || booking.status === bookingFilter)
                            .map((booking) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-secondary-dark/50 rounded-xl p-6 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">{booking.subject}</h3>
                            <p className="text-gray-400 text-sm">mit {booking.tutorName}</p>
                          </div>
                          <div className={`flex items-center gap-2 ${getStatusColor(booking.status)} font-semibold text-sm`}>
                            {getStatusIcon(booking.status)}
                            {getStatusLabel(booking.status)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500 mb-1">Datum</div>
                            <div className="text-white font-medium">
                              {new Date(booking.date).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Uhrzeit</div>
                            <div className="text-white font-medium">{booking.time} Uhr</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Dauer</div>
                            <div className="text-white font-medium">{booking.duration} Min</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Ort</div>
                            <div className="text-white font-medium flex items-center gap-2">
                              {booking.location === 'online' ? (
                                <>
                                  <Monitor className="w-4 h-4" />
                                  Online
                                </>
                              ) : (
                                <>
                                  <Home className="w-4 h-4" />
                                  Vor Ort
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {booking.status === 'scheduled' && (
                          <div className="mt-4 pt-4 border-t border-white/10 flex gap-3">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleReschedule(booking)}
                            >
                              Umbuchen
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleCancelClick(booking)}
                              className="hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
                            >
                              Stornieren
                            </Button>
                          </div>
                        )}
                      </motion.div>
                      ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Messages Tab */}
              {activeTab === 'messages' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Nachrichten</h2>
                  
                  {userBookings.length === 0 ? (
                    <div className="p-12 bg-secondary-dark/30 rounded-xl text-center">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                      <h3 className="text-xl font-bold text-white mb-2">Noch keine Nachrichten</h3>
                      <p className="text-gray-400 mb-6">
                        Buche einen Tutor, um direkt mit ihm zu chatten!
                      </p>
                      <Link href="/matching">
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Tutor finden
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <MessagesInterface 
                      userBookings={userBookings} 
                      userId={user?.id || 'anonymous'} 
                    />
                  )}
                </div>
              )}

              {/* Calendar Tab */}
              {activeTab === 'calendar' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Kalender</h2>
                  
                  <div className="bg-secondary-dark/50 rounded-xl p-8 text-center">
                    <Calendar className="w-16 h-16 text-accent mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Kalenderansicht</h3>
                    <p className="text-gray-400 mb-6">
                      Integration mit <strong className="text-accent">Cal.com</strong> für vollständige Kalenderverwaltung
                    </p>
                    
                    <div className="max-w-md mx-auto space-y-3 text-left mb-6">
                      {userBookings.length === 0 ? (
                        <div className="text-center text-gray-400 py-4">
                          Keine anstehenden Termine
                        </div>
                      ) : (
                        userBookings
                          .filter(b => b.status === 'scheduled')
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((booking) => (
                          <div key={booking.id} className="flex items-center gap-4 bg-primary-dark/50 p-4 rounded-lg">
                            <div className="w-12 h-12 bg-accent/20 rounded-lg flex flex-col items-center justify-center">
                              <div className="text-xs text-gray-400">
                                {new Date(booking.date).toLocaleDateString('de-DE', { month: 'short' })}
                              </div>
                              <div className="text-lg font-bold text-accent">
                                {new Date(booking.date).getDate()}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-white">{booking.subject}</div>
                              <div className="text-sm text-gray-400">{booking.time} Uhr - {booking.tutorName}</div>
                            </div>
                          </div>
                          ))
                      )}
                    </div>

                    <Button variant="outline" disabled>
                      Cal.com Kalender öffnen
                    </Button>
                  </div>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Mein Profil</h2>
                  
                  <div className="space-y-6">
                    <div className="bg-secondary-dark/50 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Account-Informationen</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">Name</label>
                          <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Dein vollständiger Name"
                            className="w-full p-3 rounded-lg bg-primary-dark text-white border border-accent/30 focus:border-accent outline-none"
                          />
                          {!userName && (
                            <p className="text-yellow-400 text-xs mt-1">
                              ⚠️ Bitte gib deinen Namen ein, damit er bei Buchungen verwendet wird
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-gray-400 text-sm mb-2">E-Mail</label>
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full p-3 rounded-lg bg-primary-dark/50 text-gray-400 border border-accent/20 outline-none cursor-not-allowed"
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            E-Mail kann nicht geändert werden
                          </p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Button 
                          onClick={handleSaveName} 
                          disabled={isSavingName || !userName.trim()}
                        >
                          {isSavingName ? 'Speichern...' : 'Änderungen speichern'}
                        </Button>
                      </div>
                    </div>

                    <div className="bg-secondary-dark/50 rounded-xl p-6">
                      <h3 className="text-lg font-bold text-white mb-4">Authentifizierung</h3>
                      <p className="text-gray-400 mb-4">
                        Login wird über <strong className="text-accent">Supabase Auth</strong> verwaltet
                      </p>
                      <div className="flex gap-3">
                        <Button variant="outline">Passwort ändern</Button>
                        <Button variant="outline" onClick={handleSignOut}>Abmelden</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </FrostedCard>
          </div>
        </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && bookingToCancel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-secondary-dark border border-red-500/30 rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Buchung stornieren?</h3>
                <p className="text-gray-400 text-sm">
                  Möchtest du diese Buchung wirklich stornieren?
                </p>
              </div>
            </div>

            <div className="bg-primary-dark/50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Fach:</span>
                  <span className="text-white font-medium">{bookingToCancel.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tutor:</span>
                  <span className="text-white font-medium">{bookingToCancel.tutorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Datum:</span>
                  <span className="text-white font-medium">
                    {new Date(bookingToCancel.date).toLocaleDateString('de-DE')} um {bookingToCancel.time} Uhr
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <p className="text-yellow-200 text-xs">
                ⚠️ <strong>Hinweis:</strong> Die Stornierung wird mit Cal.com synchronisiert. 
                Bitte kontaktiere deinen Tutor, falls du Fragen zur Stornierungsbedingungen hast.
              </p>
            </div>

            {/* Error Message */}
            {cancelError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-200 text-xs">
                  ❌ <strong>Fehler:</strong> {cancelError}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setBookingToCancel(null);
                  setCancelError(null);
                }}
                disabled={isCancelling}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={confirmCancellation}
                disabled={isCancelling}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird storniert...
                  </>
                ) : (
                  'Ja, stornieren'
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </SendbirdProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
