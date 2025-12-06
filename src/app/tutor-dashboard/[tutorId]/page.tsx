'use client';

import { useState, useEffect, use } from 'react';
import { tutors } from '@/data/mockData';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import TutorChatWidget from '@/components/chat/TutorChatWidget';
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
  
  const [activeTab, setActiveTab] = useState<'bookings' | 'messages' | 'availability'>('bookings');
  const [bookings, setBookings] = useState<TutorBooking[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<{ id: string; name: string } | null>(null);
  
  // Find the tutor from our data
  const tutor = tutors.find(t => t.id === tutorId);
  
  // Load tutor's bookings from Supabase (with localStorage fallback)
  useEffect(() => {
    const loadBookings = async () => {
      try {
        if (!tutor) return;
        
        // First try loading from Supabase
        const { getTutorBookings } = await import('@/lib/supabase');
        const supabaseBookings = await getTutorBookings(tutor.name);
        
        if (supabaseBookings && supabaseBookings.length > 0) {
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
          setBookings(formattedBookings);
          console.log(`[TutorDashboard] Loaded ${formattedBookings.length} bookings from Supabase`);
        } else {
          // Fallback to localStorage if Supabase is empty or not configured
          const allBookingsJson = localStorage.getItem('allTutorBookings') || '{}';
          const allBookings = JSON.parse(allBookingsJson);
          const tutorBookings = allBookings[tutorId] || [];
          setBookings(tutorBookings);
          console.log(`[TutorDashboard] Loaded ${tutorBookings.length} bookings from localStorage`);
        }
      } catch (error) {
        console.error('Failed to load bookings from Supabase, trying localStorage:', error);
        // Fallback to localStorage on error
        const allBookingsJson = localStorage.getItem('allTutorBookings') || '{}';
        const allBookings = JSON.parse(allBookingsJson);
        const tutorBookings = allBookings[tutorId] || [];
        setBookings(tutorBookings);
      }
    };
    
    loadBookings();
  }, [tutorId, tutor]);
  
  // Load tutor's availability
  useEffect(() => {
    const loadAvailability = () => {
      // First check localStorage for saved availability
      const savedAvailability = localStorage.getItem(`tutorAvailability_${tutorId}`);
      if (savedAvailability) {
        setAvailability(JSON.parse(savedAvailability));
      } else if (tutor?.availableSlots) {
        // Fall back to tutor's default availability
        setAvailability(tutor.availableSlots);
      }
    };
    
    loadAvailability();
  }, [tutorId, tutor]);
  
  // Save availability to localStorage and update tutor data
  const saveAvailability = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem(`tutorAvailability_${tutorId}`, JSON.stringify(availability));
      
      // In a real app, this would update Supabase
      // For now, we'll also update a global availability store
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
        <FrostedCard className="p-8 text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Tutor nicht gefunden</h1>
          <p className="text-gray-400">Die angegebene Tutor-ID existiert nicht.</p>
        </FrostedCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark">
      {/* Header */}
      <header className="border-b border-white/10 bg-primary-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold">
                {tutor.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-white font-semibold">{tutor.name}</h1>
                <p className="text-gray-400 text-sm">Tutor Dashboard</p>
              </div>
            </div>
            <div className="text-gray-400 text-sm">
              {tutor.subjects.join(', ')}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'bookings', label: 'Buchungen', icon: Calendar },
            { id: 'messages', label: 'Nachrichten', icon: MessageCircle },
            { id: 'availability', label: 'Verfügbarkeit', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-white mb-4">Deine Buchungen</h2>
            
            {bookings.length === 0 ? (
              <FrostedCard className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Noch keine Buchungen vorhanden.</p>
                <p className="text-gray-500 text-sm mt-2">
                  Wenn Eltern dich buchen, erscheinen die Termine hier.
                </p>
              </FrostedCard>
            ) : (
              <div className="grid gap-4">
                {bookings.map((booking) => (
                  <FrostedCard key={booking.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary-dark flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{booking.parentName}</h3>
                          <p className="text-accent text-sm">{booking.subject}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(booking.date).toLocaleDateString('de-DE', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {booking.time.slice(0, 5)} Uhr
                            </span>
                            <span className="flex items-center gap-1">
                              {booking.location === 'online' ? (
                                <Monitor className="w-4 h-4" />
                              ) : (
                                <Home className="w-4 h-4" />
                              )}
                              {booking.location === 'online' ? 'Online' : 'Vor Ort'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                      <div className="mt-4 p-3 bg-primary-dark/50 rounded-lg">
                        <p className="text-gray-300 text-sm">{booking.message}</p>
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Verfügbarkeit einstellen</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Wähle die Zeiten aus, zu denen du für Nachhilfe verfügbar bist.
                </p>
              </div>
              <Button
                onClick={saveAvailability}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Speichern...' : 'Speichern'}
              </Button>
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

            <FrostedCard className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 font-medium py-3 px-2 min-w-[100px]">Zeit</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.id} className="text-center text-gray-400 font-medium py-3 px-2 min-w-[80px]">
                          {day.name.slice(0, 2)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(time => (
                      <tr key={time} className="border-b border-white/5 hover:bg-white/5">
                        <td className="text-gray-300 py-2 px-2 text-sm">{time}</td>
                        {DAYS_OF_WEEK.map(day => (
                          <td key={`${day.id}-${time}`} className="text-center py-2 px-2">
                            <button
                              onClick={() => toggleTimeSlot(day.id, time)}
                              className={`w-8 h-8 rounded-lg transition-all ${
                                isTimeSelected(day.id, time)
                                  ? 'bg-accent text-white'
                                  : 'bg-white/5 text-gray-500 hover:bg-white/10'
                              }`}
                            >
                              {isTimeSelected(day.id, time) && <Check className="w-4 h-4 mx-auto" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FrostedCard>

            {/* Current Availability Summary */}
            <FrostedCard className="p-6">
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
