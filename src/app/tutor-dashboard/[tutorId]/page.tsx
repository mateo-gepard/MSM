'use client';

import { useState, useEffect, use, Fragment } from 'react';
import { tutors } from '@/data/mockData';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import TutorChatWidget from '@/components/chat/TutorChatWidget';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { WeekAvailabilityEditor } from '@/components/tutor/WeekAvailabilityEditor';
import { 
  Calendar,
  MessageCircle,
  Clock,
  User,
  Check,
  X,
  Monitor,
  Home,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';

// Days of the week for availability
const DAYS_OF_WEEK = [
  { id: 'monday', name: 'Montag' },
  { id: 'tuesday', name: 'Dienstag' },
  { id: 'wednesday', name: 'Mittwoch' },
  { id: 'thursday', name: 'Donnerstag' },
  { id: 'friday', name: 'Freitag' },
  { id: 'saturday', name: 'Samstag' },
  { id: 'sunday', name: 'Sonntag' }
];

// Time slots available for selection
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00'
];

interface TutorBooking {
  id: string;
  parentName: string;
  parentEmail: string;
  parentId?: string; // Supabase user ID
  subject: string;
  date: string;
  time: string;
  location: 'online' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
  message?: string;
}

interface AvailabilitySlot {
  day: string;
  times: string[];
}

export default function TutorDashboard({ params }: { params: Promise<{ tutorId: string }> }) {
  const resolvedParams = use(params);
  const tutorId = resolvedParams.tutorId;
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'bookings' | 'messages' | 'availability'>('bookings');
  const [bookings, setBookings] = useState<TutorBooking[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<{ id: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [viewMode, setViewMode] = useState<'grid' | 'schedule' | 'slider'>('schedule'); // Default to Stundenplan
  const [timeRanges, setTimeRanges] = useState<Record<string, Array<{ start: string; end: string }>>>({});
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true); // Track Supabase connection
  
  // Find the tutor from our data
  const tutor = tutors.find(t => t.id === tutorId);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=/tutor-dashboard/${tutorId}`);
    }
  }, [user, loading, router, tutorId]);
  
  // Load tutor's bookings from Supabase (with localStorage fallback)
  useEffect(() => {
    // Skip if not authenticated yet
    if (!user || !tutor) return;
    
    const loadBookings = async () => {
      try {
        
        // First try loading from Supabase
        const { getTutorBookings } = await import('@/lib/supabase');
        const supabaseBookings = await getTutorBookings(tutor.name);
        
        // If we got a response (even if empty), Supabase is connected
        if (supabaseBookings !== null && supabaseBookings !== undefined) {
          setSupabaseConnected(true);
          
          if (supabaseBookings.length > 0) {
            // Import updateBookingStatus function
            const { updateBookingStatus } = await import('@/lib/supabase');
            
            // Transform Supabase bookings to match TutorBooking interface
            const formattedBookings = supabaseBookings.map((booking: any) => ({
              id: booking.calcom_booking_id || booking.id,
              parentName: booking.contact_name,
              parentEmail: booking.contact_email,
              parentId: booking.user_id,
              subject: booking.subject,
              date: booking.date,
              time: booking.time,
              location: booking.location,
              status: booking.status,
              message: booking.message,
              createdAt: booking.created_at
            }));
            
            // Auto-update past bookings to 'completed' status
            const now = new Date();
            const updatedBookings = formattedBookings.map((booking: TutorBooking) => {
              // Only update if booking is scheduled and date/time has passed
              if (booking.status === 'scheduled') {
                const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
                if (bookingDateTime < now) {
                  // Update status in Supabase (async, fire and forget)
                  updateBookingStatus(booking.id, 'completed').catch(err => 
                    console.error('Failed to update booking status:', err)
                  );
                  return { ...booking, status: 'completed' as const };
                }
              }
              return booking;
            });
            
            setBookings(updatedBookings);
            console.log(`[TutorDashboard] Loaded ${updatedBookings.length} bookings from Supabase`);
          } else {
            // Supabase is working but has no bookings yet
            setBookings([]);
            console.log(`[TutorDashboard] No bookings in Supabase yet (empty but connected)`);
          }
        } else {
          // Supabase query failed, fallback to localStorage
          setSupabaseConnected(false);
          const allBookingsJson = localStorage.getItem('allTutorBookings') || '{}';
          const allBookings = JSON.parse(allBookingsJson);
          const tutorBookings = allBookings[tutorId] || [];
          setBookings(tutorBookings);
          console.log(`[TutorDashboard] Loaded ${tutorBookings.length} bookings from localStorage`);
        }
      } catch (error) {
        console.error('Failed to load bookings from Supabase, trying localStorage:', error);
        setSupabaseConnected(false);
        // Fallback to localStorage on error
        const allBookingsJson = localStorage.getItem('allTutorBookings') || '{}';
        const allBookings = JSON.parse(allBookingsJson);
        const tutorBookings = allBookings[tutorId] || [];
        setBookings(tutorBookings);
      }
    };
    
    // Only load bookings if user is authenticated
    if (user) {
      loadBookings();
    }
  }, [tutorId, tutor, user]);
  
  // Load tutor's availability
  useEffect(() => {
    // Skip if not authenticated yet
    if (!user || !tutor) return;
    
    const loadAvailability = async () => {
      try {
        
        // First try loading from Supabase
        const { getTutorAvailability } = await import('@/lib/supabase');
        const supabaseAvailability = await getTutorAvailability(tutor.name);
        
        if (supabaseAvailability && supabaseAvailability.length > 0) {
          setAvailability(supabaseAvailability);
          console.log(`[TutorDashboard] Loaded availability from Supabase for ${tutor.name}`);
        } else {
          // Fallback to localStorage if Supabase is empty
          const savedAvailability = localStorage.getItem(`tutorAvailability_${tutorId}`);
          if (savedAvailability) {
            setAvailability(JSON.parse(savedAvailability));
            console.log(`[TutorDashboard] Loaded availability from localStorage`);
          } else if (tutor?.availableSlots) {
            // Fall back to tutor's default availability
            setAvailability(tutor.availableSlots);
            console.log(`[TutorDashboard] Using default availability from mockData`);
          }
        }
      } catch (error) {
        console.error('Failed to load availability from Supabase, using localStorage:', error);
        // Fallback to localStorage on error
        const savedAvailability = localStorage.getItem(`tutorAvailability_${tutorId}`);
        if (savedAvailability) {
          setAvailability(JSON.parse(savedAvailability));
        } else if (tutor?.availableSlots) {
          setAvailability(tutor.availableSlots);
        }
      }
    };
    
    loadAvailability();
  }, [tutorId, tutor, user]);
  
  // Save availability to Supabase and localStorage
  const saveAvailability = async () => {
    setIsSaving(true);
    try {
      if (!tutor) {
        throw new Error('Tutor not found');
      }
      
      // Save to Supabase first
      try {
        const { saveTutorAvailability } = await import('@/lib/supabase');
        await saveTutorAvailability(tutor.name, availability);
        console.log('✅ Availability saved to Supabase');
      } catch (supabaseError) {
        console.warn('⚠️ Failed to save to Supabase, saving to localStorage only:', supabaseError);
      }
      
      // Also save to localStorage as backup
      localStorage.setItem(`tutorAvailability_${tutorId}`, JSON.stringify(availability));
      
      // Update global availability store
      const globalAvailability = JSON.parse(localStorage.getItem('tutorAvailabilities') || '{}');
      globalAvailability[tutorId] = availability;
      localStorage.setItem('tutorAvailabilities', JSON.stringify(globalAvailability));
      
      setSaveMessage('Verfügbarkeit gespeichert!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save availability:', error);
      setSaveMessage('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Toggle a time slot for a day
  const toggleTimeSlot = (day: string, time: string) => {
    setAvailability(prev => {
      const daySlot = prev.find(s => s.day === day);
      if (daySlot) {
        // Day exists, toggle the time
        const times = daySlot.times.includes(time)
          ? daySlot.times.filter(t => t !== time)
          : [...daySlot.times, time].sort();
        
        if (times.length === 0) {
          // Remove the day if no times
          return prev.filter(s => s.day !== day);
        }
        
        return prev.map(s => s.day === day ? { ...s, times } : s);
      } else {
        // Add new day with this time
        return [...prev, { day, times: [time] }];
      }
    });
  };
  
  // Handle mouse down to start drag selection
  const handleMouseDown = (day: string, time: string) => {
    setIsDragging(true);
    const isCurrentlySelected = isTimeSelected(day, time);
    setDragMode(isCurrentlySelected ? 'deselect' : 'select');
    toggleTimeSlot(day, time);
  };
  
  // Handle mouse enter during drag
  const handleMouseEnter = (day: string, time: string) => {
    if (!isDragging) return;
    
    const isCurrentlySelected = isTimeSelected(day, time);
    if (dragMode === 'select' && !isCurrentlySelected) {
      toggleTimeSlot(day, time);
    } else if (dragMode === 'deselect' && isCurrentlySelected) {
      toggleTimeSlot(day, time);
    }
  };
  
  // Handle mouse up to end drag selection
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Quick select entire day
  const selectEntireDay = (day: string) => {
    const daySlot = availability.find(s => s.day === day);
    const allTimesSelected = daySlot && daySlot.times.length === TIME_SLOTS.length;
    
    setAvailability(prev => {
      if (allTimesSelected) {
        // Deselect all times for this day
        return prev.filter(s => s.day !== day);
      } else {
        // Select all times for this day
        const filtered = prev.filter(s => s.day !== day);
        return [...filtered, { day, times: [...TIME_SLOTS] }];
      }
    });
  };
  
  // Quick select entire time slot across all days
  const selectEntireTimeSlot = (time: string) => {
    const allDaysHaveTime = DAYS_OF_WEEK.every(day => isTimeSelected(day.id, time));
    
    setAvailability(prev => {
      if (allDaysHaveTime) {
        // Remove this time from all days
        return prev.map(slot => ({
          ...slot,
          times: slot.times.filter(t => t !== time)
        })).filter(slot => slot.times.length > 0);
      } else {
        // Add this time to all days
        const updated = [...prev];
        DAYS_OF_WEEK.forEach(day => {
          const daySlot = updated.find(s => s.day === day.id);
          if (daySlot) {
            if (!daySlot.times.includes(time)) {
              daySlot.times = [...daySlot.times, time].sort();
            }
          } else {
            updated.push({ day: day.id, times: [time] });
          }
        });
        return updated;
      }
    });
  };
  
  // Clear all availability
  const clearAll = () => {
    if (confirm('Möchtest du wirklich alle Verfügbarkeiten löschen?')) {
      setAvailability([]);
      setTimeRanges({});
    }
  };
  
  // Add time range for slider view
  const addTimeRange = (day: string) => {
    setTimeRanges(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: '09:00', end: '17:00' }]
    }));
  };
  
  // Update time range
  const updateTimeRange = (day: string, index: number, field: 'start' | 'end', value: string) => {
    setTimeRanges(prev => {
      const dayRanges = [...(prev[day] || [])];
      dayRanges[index] = { ...dayRanges[index], [field]: value };
      return { ...prev, [day]: dayRanges };
    });
    
    // Convert ranges to availability slots
    syncRangesToAvailability();
  };
  
  // Remove time range
  const removeTimeRange = (day: string, index: number) => {
    setTimeRanges(prev => {
      const dayRanges = [...(prev[day] || [])];
      dayRanges.splice(index, 1);
      return { ...prev, [day]: dayRanges };
    });
    
    syncRangesToAvailability();
  };
  
  // Sync time ranges to availability format
  const syncRangesToAvailability = () => {
    const newAvailability: AvailabilitySlot[] = [];
    
    Object.entries(timeRanges).forEach(([day, ranges]) => {
      const times: string[] = [];
      ranges.forEach(range => {
        const startIndex = TIME_SLOTS.indexOf(range.start);
        const endIndex = TIME_SLOTS.indexOf(range.end);
        if (startIndex !== -1 && endIndex !== -1) {
          for (let i = startIndex; i <= endIndex; i++) {
            if (!times.includes(TIME_SLOTS[i])) {
              times.push(TIME_SLOTS[i]);
            }
          }
        }
      });
      
      if (times.length > 0) {
        newAvailability.push({ day, times: times.sort() });
      }
    });
    
    setAvailability(newAvailability);
  };
  
  // Initialize time ranges from availability when switching to slider view
  useEffect(() => {
    if (viewMode === 'slider' && Object.keys(timeRanges).length === 0 && availability.length > 0) {
      const ranges: Record<string, Array<{ start: string; end: string }>> = {};
      
      availability.forEach(slot => {
        if (slot.times.length > 0) {
          // Group consecutive times into ranges
          const sortedTimes = [...slot.times].sort();
          const grouped: Array<{ start: string; end: string }> = [];
          let rangeStart = sortedTimes[0];
          let prevTime = sortedTimes[0];
          
          for (let i = 1; i < sortedTimes.length; i++) {
            const prevIndex = TIME_SLOTS.indexOf(prevTime);
            const currIndex = TIME_SLOTS.indexOf(sortedTimes[i]);
            
            if (currIndex - prevIndex > 1) {
              // Gap detected, end current range
              grouped.push({ start: rangeStart, end: prevTime });
              rangeStart = sortedTimes[i];
            }
            prevTime = sortedTimes[i];
          }
          
          // Add final range
          grouped.push({ start: rangeStart, end: prevTime });
          ranges[slot.day] = grouped;
        }
      });
      
      setTimeRanges(ranges);
    }
  }, [viewMode, availability, timeRanges]);
  
  // Check if a time slot is selected
  const isTimeSelected = (day: string, time: string) => {
    const daySlot = availability.find(s => s.day === day);
    return daySlot?.times.includes(time) || false;
  };
  
  // Get unique parents from bookings for the chat
  const uniqueParents = Array.from(new Set(bookings.map(b => b.parentId || b.parentEmail)))
    .map(id => {
      const booking = bookings.find(b => (b.parentId || b.parentEmail) === id);
      if (!booking) return null;
      
      // Only show parents that have a parentId (Supabase user ID)
      if (!booking.parentId) {
        console.warn('[TutorDashboard] Booking missing parentId:', booking);
        return null;
      }
      
      return {
        id: booking.parentId, // Use Supabase user ID
        name: booking.parentName,
        email: booking.parentEmail,
        subject: booking.subject
      };
    })
    .filter(Boolean);
  
  if (!tutor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center">
        <FrostedCard className="p-6 sm:p-8 text-center">
          <X className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Tutor nicht gefunden</h1>
          <p className="text-gray-400 text-sm sm:text-base">Die angegebene Tutor-ID existiert nicht.</p>
        </FrostedCard>
      </div>
    );
  }
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#081525] via-[#102A43] to-[#081525] flex items-center justify-center">
        <div className="text-white text-xl">Laden...</div>
      </div>
    );
  }
  
  // Don't render dashboard if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark">
      {/* Header */}
      <header className="border-b border-white/10 bg-primary-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm sm:text-base">
                {tutor.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-white font-semibold text-sm sm:text-base">{tutor.name}</h1>
                <p className="text-gray-400 text-xs sm:text-sm">Tutor Dashboard</p>
              </div>
            </div>
            <div className="text-gray-400 text-xs sm:text-sm hidden sm:block">
              {tutor.subjects.join(', ')}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Supabase Warning Banner - Only show if actually disconnected */}
        {!supabaseConnected && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-yellow-400 mt-0.5">⚠️</div>
              <div>
                <div className="text-yellow-200 font-semibold mb-1">
                  Offline-Modus aktiv
                </div>
                <div className="text-yellow-300 text-sm">
                  Daten werden nur lokal gespeichert und sind nicht auf anderen Geräten verfügbar. 
                  {process.env.NODE_ENV === 'development' && (
                    <span> Konfiguriere Supabase in der <code className="bg-black/20 px-1 rounded">.env.local</code> Datei für Cloud-Sync.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { id: 'bookings', label: 'Buchungen', icon: Calendar },
            { id: 'messages', label: 'Nachrichten', icon: MessageCircle },
            { id: 'availability', label: 'Verfügbarkeit', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-all whitespace-nowrap text-sm ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white active:bg-white/15'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.slice(0, 4)}.</span>
            </button>
          ))}
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 sm:space-y-4"
          >
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Deine Buchungen</h2>
            
            {bookings.length === 0 ? (
              <FrostedCard className="p-6 sm:p-8 text-center">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-400 text-sm sm:text-base">Noch keine Buchungen vorhanden.</p>
                <p className="text-gray-500 text-xs sm:text-sm mt-2">
                  Wenn Eltern dich buchen, erscheinen die Termine hier.
                </p>
              </FrostedCard>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {bookings.map((booking) => (
                  <FrostedCard key={booking.id} className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary-dark flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-white font-semibold text-sm sm:text-base">{booking.parentName}</h3>
                          <p className="text-accent text-xs sm:text-sm">{booking.subject}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                              {new Date(booking.date).toLocaleDateString('de-DE', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                              {booking.time.slice(0, 5)} Uhr
                            </span>
                            <span className="flex items-center gap-1">
                              {booking.location === 'online' ? (
                                <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />
                              ) : (
                                <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                              )}
                              {booking.location === 'online' ? 'Online' : 'Vor Ort'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`self-start px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                        booking.status === 'scheduled' 
                          ? 'bg-green-500/20 text-green-400'
                          : booking.status === 'completed'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {booking.status === 'scheduled' ? 'Geplant' : 
                         booking.status === 'completed' ? 'Abgeschlossen' : 'Storniert'}
                      </span>
                    </div>
                    {booking.message && (
                      <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-primary-dark/50 rounded-lg">
                        <p className="text-gray-300 text-xs sm:text-sm">{booking.message}</p>
                      </div>
                    )}
                  </FrostedCard>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="scroll-mt-20"
          >
            <h2 className="text-xl font-bold text-white mb-4">Nachrichten</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[600px]">
              {/* Parent List Sidebar */}
              <div className="md:col-span-1 bg-secondary-dark/50 rounded-xl overflow-hidden border border-white/10">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-semibold text-white">Eltern</h3>
                  <p className="text-xs text-gray-400 mt-1">{uniqueParents.length} Gespräche</p>
                </div>
                <div className="overflow-y-auto h-[calc(600px-80px)]">
                  {uniqueParents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Noch keine Nachrichten</p>
                    </div>
                  ) : (
                    uniqueParents.map((parent) => {
                      if (!parent) return null;
                      const isSelected = selectedParent?.id === parent.id;
                      
                      return (
                        <button
                          key={parent.id}
                          onClick={() => setSelectedParent({ id: parent.id, name: parent.name })}
                          className={`w-full p-4 text-left transition-all border-b border-white/5 hover:bg-primary-dark/50 ${
                            isSelected ? 'bg-primary-dark/70 border-l-4 border-l-accent' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                              isSelected ? 'bg-accent text-white' : 'bg-secondary-dark text-gray-400'
                            }`}>
                              {parent.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {parent.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{parent.subject}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat Window */}
              <div className="md:col-span-3 bg-secondary-dark/50 rounded-xl overflow-hidden border border-white/10">
                {selectedParent ? (
                  <div className="h-full">
                    <TutorChatWidget
                      tutorId={tutorId}
                      parentId={selectedParent.id}
                      parentName={selectedParent.name}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Wähle ein Gespräch aus</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Verfügbarkeit einstellen</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Wähle deine bevorzugte Ansicht und setze deine verfügbaren Zeiten.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={clearAll}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </Button>
                <Button
                  onClick={saveAvailability}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>

            {/* View Mode Selection */}
            <div className="flex gap-2 p-1 bg-secondary-dark/50 rounded-lg w-fit">
              <button
                onClick={() => setViewMode('schedule')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📅 Stundenplan
              </button>
              <button
                onClick={() => setViewMode('slider')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'slider'
                    ? 'bg-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ⏱️ Zeitbereiche
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                🔲 Raster
              </button>
            </div>

            {saveMessage && (
              <div className={`p-3 rounded-lg ${
                saveMessage.includes('Fehler') 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {saveMessage}
              </div>
            )}

            {/* Schedule View (Stundenplan) */}
            {viewMode === 'schedule' && (
              <FrostedCard className="p-6" hover={false}>
                <div className="grid grid-cols-8 gap-2">
                  {/* Header */}
                  <div className="text-xs text-gray-500 font-medium">Zeit</div>
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day.id} className="text-xs text-gray-400 font-medium text-center">
                      {day.name.substring(0, 2)}
                    </div>
                  ))}
                  
                  {/* Time blocks */}
                  {['08:00-12:00', '12:00-14:00', '14:00-18:00', '18:00-21:00'].map(timeBlock => {
                    const [start, end] = timeBlock.split('-');
                    const startIdx = TIME_SLOTS.indexOf(start);
                    const endIdx = TIME_SLOTS.indexOf(end);
                    const blockTimes = TIME_SLOTS.slice(startIdx, endIdx);
                    
                    return (
                      <Fragment key={timeBlock}>
                        <div className="text-xs text-gray-400 py-4">{timeBlock}</div>
                        {DAYS_OF_WEEK.map(day => {
                          const hasAnyTime = blockTimes.some(t => isTimeSelected(day.id, t));
                          const hasAllTimes = blockTimes.every(t => isTimeSelected(day.id, t));
                          
                          return (
                            <button
                              key={day.id}
                              onClick={() => {
                                // Toggle all times in this block for this day
                                blockTimes.forEach(time => {
                                  if (hasAllTimes) {
                                    // Deselect all
                                    if (isTimeSelected(day.id, time)) toggleTimeSlot(day.id, time);
                                  } else {
                                    // Select all
                                    if (!isTimeSelected(day.id, time)) toggleTimeSlot(day.id, time);
                                  }
                                });
                              }}
                              className={`p-4 rounded-lg transition-all text-center text-xs font-medium ${
                                hasAllTimes
                                  ? 'bg-green-500 text-white'
                                  : hasAnyTime
                                  ? 'bg-accent/40 text-white'
                                  : 'bg-white/5 text-gray-500 hover:bg-white/10'
                              }`}
                            >
                              {hasAllTimes ? 'Verfügbar' : hasAnyTime ? 'Teilweise' : 'Nicht verfügbar'}
                            </button>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              </FrostedCard>
            )}

            {/* Slider View (Zeitbereiche) */}
            {viewMode === 'slider' && (
              <FrostedCard className="p-6" hover={false}>
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map(day => {
                    const ranges = timeRanges[day.id] || [];
                    
                    return (
                      <div key={day.id} className="border-b border-white/5 pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-white font-medium">{day.name}</h3>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addTimeRange(day.id)}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Plus className="w-3 h-3" />
                            Zeitblock
                          </Button>
                        </div>
                        
                        {ranges.length === 0 ? (
                          <p className="text-gray-500 text-sm">Keine Zeiten festgelegt</p>
                        ) : (
                          <div className="space-y-2">
                            {ranges.map((range, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <select
                                  value={range.start}
                                  onChange={(e) => updateTimeRange(day.id, idx, 'start', e.target.value)}
                                  className="bg-secondary-dark border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                                >
                                  {TIME_SLOTS.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <span className="text-gray-400">bis</span>
                                <select
                                  value={range.end}
                                  onChange={(e) => updateTimeRange(day.id, idx, 'end', e.target.value)}
                                  className="bg-secondary-dark border border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                                >
                                  {TIME_SLOTS.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => removeTimeRange(day.id, idx)}
                                  className="text-red-400 hover:text-red-300 p-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </FrostedCard>
            )}

            {/* Grid View (Original) */}
            {viewMode === 'grid' && (
              <FrostedCard className="p-6" hover={false}>
              <div className="overflow-x-auto" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <table className="w-full select-none">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 font-medium py-3 px-2 min-w-[100px]">
                        <span className="text-xs">Zeit</span>
                      </th>
                      {DAYS_OF_WEEK.map(day => {
                        const daySlot = availability.find(s => s.day === day.id);
                        const allSelected = daySlot && daySlot.times.length === TIME_SLOTS.length;
                        return (
                          <th key={day.id} className="text-center py-3 px-2 min-w-[80px]">
                            <button
                              onClick={() => selectEntireDay(day.id)}
                              className={`w-full px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                allSelected
                                  ? 'bg-accent text-white'
                                  : daySlot && daySlot.times.length > 0
                                  ? 'bg-accent/30 text-accent hover:bg-accent/50'
                                  : 'text-gray-400 hover:bg-white/10'
                              }`}
                              title={`Ganzen ${day.name} ${allSelected ? 'abwählen' : 'auswählen'}`}
                            >
                              {day.name.slice(0, 2)}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(time => {
                      const allDaysSelected = DAYS_OF_WEEK.every(day => isTimeSelected(day.id, time));
                      const someDaysSelected = DAYS_OF_WEEK.some(day => isTimeSelected(day.id, time));
                      
                      return (
                        <tr key={time} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-2">
                            <button
                              onClick={() => selectEntireTimeSlot(time)}
                              className={`w-full text-left px-2 py-1 rounded-lg text-xs transition-all ${
                                allDaysSelected
                                  ? 'bg-accent/20 text-accent font-semibold'
                                  : someDaysSelected
                                  ? 'text-gray-300 hover:bg-white/10'
                                  : 'text-gray-500 hover:bg-white/10'
                              }`}
                              title={`${time} für ${allDaysSelected ? 'alle Tage abwählen' : 'alle Tage auswählen'}`}
                            >
                              {time}
                            </button>
                          </td>
                          {DAYS_OF_WEEK.map(day => (
                            <td key={`${day.id}-${time}`} className="text-center py-2 px-2">
                              <button
                                onMouseDown={() => handleMouseDown(day.id, time)}
                                onMouseEnter={() => handleMouseEnter(day.id, time)}
                                className={`w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                                  isTimeSelected(day.id, time)
                                    ? 'bg-accent text-white shadow-lg'
                                    : 'bg-white/5 text-gray-500 hover:bg-white/10'
                                }`}
                                title={`${day.name}, ${time}`}
                              >
                                {isTimeSelected(day.id, time) && <Check className="w-5 h-5 mx-auto" />}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-accent rounded"></div>
                  <span>Verfügbar</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white/5 rounded"></div>
                  <span>Nicht verfügbar</span>
                </div>
                <div className="flex-1"></div>
                <span>💡 Tipp: Ziehe über mehrere Felder für schnelle Auswahl</span>
              </div>
              </FrostedCard>
            )}

            {/* Current Availability Summary */}
            <FrostedCard className="p-6" hover={false}>
              <h3 className="text-white font-semibold mb-4">Aktuelle Verfügbarkeit</h3>
              {availability.length === 0 ? (
                <p className="text-gray-400">Keine Zeiten ausgewählt</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DAYS_OF_WEEK.map(day => {
                    const daySlot = availability.find(s => s.day === day.id);
                    if (!daySlot || daySlot.times.length === 0) return null;
                    
                    return (
                      <div key={day.id} className="bg-primary-dark/50 rounded-lg p-4">
                        <h4 className="text-accent font-medium mb-2">{day.name}</h4>
                        <div className="flex flex-wrap gap-1">
                          {daySlot.times.sort().map(time => (
                            <span key={time} className="bg-accent/20 text-accent text-xs px-2 py-1 rounded">
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </FrostedCard>
          </motion.div>
        )}
      </main>
    </div>
  );
}
