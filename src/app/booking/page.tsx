'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { createBooking, rescheduleBooking } from '@/lib/calcom';
import { motion } from 'framer-motion';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import { tutors, packages } from '@/data/mockData';
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Monitor, Home } from 'lucide-react';
import { TutorCard } from '@/components/tutors/TutorCard';

const bookingSteps = [
  'Fach & Tutor',
  'Service',
  'Termin',
  'Ort',
  'Kontakt'
];

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [matchingData, setMatchingData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Booking data
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<'online' | 'in-person'>('online');
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [hasExistingBookings, setHasExistingBookings] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);

  useEffect(() => {
    // Check if this is a reschedule
    const rescheduleId = searchParams.get('reschedule');
    if (rescheduleId && user?.id) {
      setIsReschedule(true);
      setRescheduleBookingId(rescheduleId);
      
      // Load the booking to reschedule (user-specific)
      const storageKey = `userBookings_${user.id}`;
      const storedBookings = localStorage.getItem(storageKey);
      if (storedBookings) {
        try {
          const bookings = JSON.parse(storedBookings);
          const bookingToReschedule = bookings.find((b: any) => b.id === rescheduleId);
          
          if (bookingToReschedule) {
            // Pre-fill the form with existing booking data
            setSelectedSubject(bookingToReschedule.subject);
            setSelectedTutor(bookingToReschedule.tutorId);
            setSelectedPackage(bookingToReschedule.packageId);
            setSelectedDate(bookingToReschedule.date);
            setSelectedTime(bookingToReschedule.time);
            setSelectedLocation(bookingToReschedule.location);
            setContactInfo(bookingToReschedule.contact || {
              name: '',
              email: '',
              phone: '',
              message: ''
            });
            console.log('Loaded booking for rescheduling:', bookingToReschedule);
          }
        } catch (error) {
          console.error('Failed to load booking for rescheduling:', error);
        }
      }
    }
    
    // Check if user has existing bookings
    if (user?.id) {
      const storageKey = `userBookings_${user.id}`;
      const storedBookings = localStorage.getItem(storageKey);
      if (storedBookings) {
        try {
          const bookings = JSON.parse(storedBookings);
          setHasExistingBookings(bookings.length > 0);
        } catch (error) {
          console.error('Failed to load bookings:', error);
        }
      }
    }
    
    // Load matching data from wizard if available
    const stored = localStorage.getItem('matchingData');
    if (stored) {
      const data = JSON.parse(stored);
      setMatchingData(data);
      console.log('Matching data loaded:', data);
      
      // Map subject IDs to full names
      const subjectMap: Record<string, string> = {
        'math': 'Mathematik',
        'physics': 'Physik',
        'chemistry': 'Chemie',
        'biology': 'Biologie',
        'cs': 'Informatik',
        'english': 'Englisch',
        'german': 'Deutsch',
        'spanish': 'Spanisch',
        'latin': 'Latein',
        'history': 'Geschichte'
      };
      
      // Set subject from wizard but stay on tutor selection
      if (data.subjects && data.subjects.length > 0) {
        // Convert first subject ID to full name
        const subjectName = subjectMap[data.subjects[0]] || data.subjects[0];
        setSelectedSubject(subjectName);
        console.log('Auto-selected subject:', subjectName);
        // Stay at step 0 to let user choose tutor from sorted list
      }
    }

    // Check for package param from pricing section
    const pkgParam = searchParams.get('package');
    if (pkgParam) {
      setSelectedPackage(pkgParam);
    }
  }, [searchParams]);

  // Calculate match score for each tutor based on matching data
  const calculateMatchScore = (tutor: typeof tutors[0]) => {
    let score = 0;
    
    if (!matchingData) return 0;
    
    // Subject match (most important)
    if (selectedSubject && tutor.subjects.some(s => s.toLowerCase().includes(selectedSubject.toLowerCase()))) {
      score += 50;
    }
    
    // Language match
    if (matchingData.languages && matchingData.languages.length > 0) {
      const langMap: Record<string, string> = {
        'de': 'Deutsch',
        'en': 'Englisch',
        'es': 'Spanisch',
        'fr': 'Französisch'
      };
      
      const matchedLanguages = matchingData.languages.filter((langId: string) => {
        const langName = langMap[langId];
        return tutor.languages.includes(langName);
      });
      
      score += (matchedLanguages.length / matchingData.languages.length) * 30;
    }
    
    // Goal match (check if tutor achievements align with goals)
    if (matchingData.goals && matchingData.goals.includes('olympiad')) {
      if (tutor.achievements.some(a => a.toLowerCase().includes('olympiade') || a.toLowerCase().includes('wettbewerb'))) {
        score += 20;
      }
    }
    
    return score;
  };

  // Filter and sort tutors by match score
  const filteredTutors = selectedSubject
    ? tutors
        .filter(t => t.subjects.some(s => s.toLowerCase().includes(selectedSubject.toLowerCase())))
        .map(t => ({ ...t, matchScore: calculateMatchScore(t) }))
        .sort((a, b) => b.matchScore - a.matchScore)
    : tutors.map(t => ({ ...t, matchScore: 0 }));

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedSubject && selectedTutor;
      case 1: return selectedPackage;
      case 2: {
        // Date and time must be selected and time must be in available slots
        if (!selectedDate || !selectedTime) return false;
        const times = getAvailableTimes();
        return times.includes(selectedTime);
      }
      case 3: return selectedLocation;
      case 4: {
        // If user is logged in, name and email are not required
        if (user) {
          return true; // Logged in users don't need to fill contact info
        }
        // For non-logged-in users, validate email and name
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return contactInfo.name && contactInfo.email && emailRegex.test(contactInfo.email);
      }
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < bookingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setBookingError(null);

    try {
      // Debug logging
      console.log('Selected values:', {
        tutor: selectedTutor,
        package: selectedPackage,
        subject: selectedSubject,
        date: selectedDate,
        time: selectedTime
      });

      const selectedTutorData = tutors.find(t => t.id === selectedTutor);
      const selectedPackageData = packages.find(p => p.id === selectedPackage);

      if (!selectedTutorData) {
        console.error('Tutor not found. Selected ID:', selectedTutor, 'Available tutors:', tutors.map(t => t.id));
        throw new Error('Bitte wähle einen Tutor aus');
      }

      if (!selectedPackageData) {
        console.error('Package not found. Selected ID:', selectedPackage, 'Available packages:', packages.map(p => p.id));
        throw new Error('Bitte wähle ein Paket aus');
      }

      const bookingData = {
        subject: selectedSubject,
        tutorId: selectedTutor,
        tutorName: selectedTutorData.name,
        packageId: selectedPackage,
        packageName: selectedPackageData.name,
        packageSessions: selectedPackageData.sessions,
        date: selectedDate,
        time: selectedTime,
        location: selectedLocation,
        contact: contactInfo,
        matchingData,
        userId: user?.id
      };

      console.log('Attempting booking:', bookingData);

      let bookingResult;
      
      if (isReschedule && rescheduleBookingId) {
        // Use reschedule API for existing bookings
        console.log('Rescheduling booking via Cal.com API...');
        
        // Only call API if booking has a Cal.com booking ID (not a local mock ID)
        const bookingIdStr = String(rescheduleBookingId);
        if (!bookingIdStr.startsWith('booking_') && !bookingIdStr.startsWith('mock-')) {
          bookingResult = await rescheduleBooking(
            rescheduleBookingId,
            `${selectedDate}T${selectedTime}:00`,
            'Europe/Berlin'
          );
          console.log('Booking rescheduled successfully:', bookingResult);
        } else {
          console.log('Local booking only (ID:', bookingIdStr, '), skipping Cal.com API call');
          bookingResult = { id: rescheduleBookingId };
        }
      } else {
        // Create new booking via Cal.com API
        console.log('Creating booking via Cal.com API...');
        bookingResult = await createBooking({
          eventTypeId: parseInt(process.env.NEXT_PUBLIC_CALCOM_EVENT_TYPE_ID || '3976917'),
          start: `${selectedDate}T${selectedTime}:00`,
          responses: {
            name: contactInfo.name || user?.user_metadata?.name || user?.email || 'Unbekannt',
            email: contactInfo.email || user?.email || '',
            notes: `Tutor: ${selectedTutorData.name} (ID: ${selectedTutor})\nPaket: ${selectedPackageData.name}\nFach: ${selectedSubject}\n${contactInfo.message || ''}`
          },
          metadata: {
            tutorId: selectedTutor,
            packageId: selectedPackage,
            subject: selectedSubject,
            location: selectedLocation,
            phone: contactInfo.phone
          },
          userId: user?.id // Pass Supabase User ID for synchronization
        });
        console.log('Booking created successfully:', bookingResult);
      }
      
      // Store booking data in localStorage for dashboard display (user-specific)
      const storageKey = user?.id ? `userBookings_${user.id}` : 'userBookings';
      const existingBookings = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      if (isReschedule && rescheduleBookingId) {
        // Update existing booking instead of creating new one
        const updatedBookings = existingBookings.map((b: any) => 
          b.id === rescheduleBookingId
            ? {
                ...bookingData,
                id: rescheduleBookingId,
                status: 'scheduled',
                createdAt: b.createdAt,
                updatedAt: new Date().toISOString()
              }
            : b
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedBookings));
        
        // Clear reschedule info
        localStorage.removeItem('rescheduleBookingId');
      } else {
        // Create new booking
        existingBookings.push({
          ...bookingData,
          id: bookingResult.id || `booking_${Date.now()}`,
          status: 'scheduled',
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(storageKey, JSON.stringify(existingBookings));
      }

      // Clear matching data
      localStorage.removeItem('matchingData');

      // Redirect to dashboard
      router.push(`/dashboard?${isReschedule ? 'rescheduleSuccess' : 'bookingSuccess'}=true`);
    } catch (error) {
      console.error('Booking failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setBookingError(`Buchung fehlgeschlagen: ${errorMessage}`);
      setIsSubmitting(false);
    }
  };

  // Dynamische Zeitslots basierend auf ausgewähltem Tutor und Datum
  const getAvailableTimes = (): string[] => {
    if (!selectedTutor || !selectedDate) {
      return [];
    }

    const tutor = tutors.find(t => t.id === selectedTutor);
    if (!tutor || !tutor.availableSlots || tutor.availableSlots.length === 0) {
      // Fallback wenn Tutor keine Slots definiert hat
      return [
        '09:00', '10:00', '11:00', '12:00', 
        '13:00', '14:00', '15:00', '16:00', 
        '17:00', '18:00', '19:00'
      ];
    }

    try {
      // Wochentag aus dem ausgewählten Datum ermitteln
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayMap[dateObj.getDay()];

      console.log('Selected date:', selectedDate, 'Day:', dayName, 'Day index:', dateObj.getDay());

      // Zeitslots für den entsprechenden Wochentag finden
      const daySlot = tutor.availableSlots.find(slot => slot.day === dayName);
      
      console.log('Found day slot:', daySlot);

      if (daySlot && Array.isArray(daySlot.times) && daySlot.times.length > 0) {
        return daySlot.times.sort();
      }

      // Wenn für diesen Tag keine Slots verfügbar sind
      return [];
    } catch (error) {
      console.error('Error calculating available times:', error);
      return [];
    }
  };

  const availableTimes = getAvailableTimes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-32">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Reschedule Banner */}
        {isReschedule && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Buchung umbuchen 📅</p>
              <p className="text-sm">
                Du bist dabei, deine bestehende Buchung umzubuchen. Ändere die gewünschten Details und bestätige am Ende.
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Matching Banner */}
        {matchingData && selectedSubject && currentStep === 0 && !isReschedule && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-accent/20 border border-accent/50 rounded-xl text-white flex items-start gap-3"
          >
            <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Matching abgeschlossen! ✨</p>
              <p className="text-sm">
                Basierend auf deinen Präferenzen haben wir {filteredTutors.length} passende Tutoren für <strong>{selectedSubject}</strong> gefunden. 
                Sie sind nach Übereinstimmung sortiert - die besten Matches zuerst!
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Tutor Selected Banner */}
        {selectedTutor && currentStep > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200 flex items-start gap-3"
          >
            <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Tutor ausgewählt! ✨</p>
              <p className="text-sm">
                Du hast <strong>{tutors.find(t => t.id === selectedTutor)?.name}</strong> für <strong>{selectedSubject}</strong> ausgewählt.
                {currentStep > 0 && " Du kannst zurückgehen, um einen anderen Tutor zu wählen."}
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Banner */}
        {bookingError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Fehler</p>
              <p className="text-sm">{bookingError}</p>
              <button 
                onClick={() => {
                  console.log('Current state:', {
                    step: currentStep,
                    subject: selectedSubject,
                    tutor: selectedTutor,
                    package: selectedPackage,
                    date: selectedDate,
                    time: selectedTime,
                    location: selectedLocation,
                    contact: contactInfo
                  });
                }}
                className="mt-2 text-xs underline"
              >
                Debug Info anzeigen (siehe Console)
              </button>
            </div>
          </motion.div>
        )}

        {/* Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {bookingSteps.map((step, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${idx < bookingSteps.length - 1 ? 'flex-1' : ''}`}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep >= idx
                        ? 'bg-accent text-white'
                        : 'bg-secondary-dark/50 text-gray-400'
                    }`}
                  >
                    {currentStep > idx ? <Check className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className="text-xs text-gray-400 mt-2 hidden sm:block">{step}</span>
                </div>
                {idx < bookingSteps.length - 1 && (
                  <div className="flex-1 h-1 mx-2">
                    <div className={`h-full rounded ${
                      currentStep > idx ? 'bg-accent' : 'bg-secondary-dark/50'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <FrostedCard className="p-8" hover={false}>
          {/* Step 0: Subject & Tutor */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Wähle Fach und Tutor</h2>
              
              {/* Subject Selection - Hide if coming from matching */}
              {!matchingData && (
                <div className="mb-6">
                  <label className="block text-white font-semibold mb-2 text-sm">Fach</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedTutor(''); // Reset tutor when subject changes
                    }}
                    className="w-full p-2.5 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none text-sm"
                  >
                    <option value="">Fach auswählen...</option>
                    {Array.from(new Set(tutors.flatMap(t => t.subjects))).map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Show selected subject if from matching */}
              {matchingData && selectedSubject && (
                <div className="mb-6 p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Ausgewähltes Fach</div>
                  <div className="text-white font-semibold">{selectedSubject}</div>
                </div>
              )}

              {/* Tutor Selection */}
              {selectedSubject && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-white font-semibold text-sm">
                      Verfügbare Tutoren
                      {matchingData && (
                        <span className="ml-2 text-xs text-gray-400">
                          (nach Übereinstimmung sortiert)
                        </span>
                      )}
                    </label>
                    <div className="text-xs text-gray-400">
                      {filteredTutors.length} {filteredTutors.length === 1 ? 'Tutor' : 'Tutoren'}
                    </div>
                  </div>
                  
                  {/* Compact Tutor List */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {filteredTutors.map((tutor, index) => (
                      <button
                        key={tutor.id}
                        onClick={() => setSelectedTutor(tutor.id)}
                        className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                          selectedTutor === tutor.id
                            ? 'bg-accent/10 border-accent'
                            : 'bg-secondary-dark/50 border-white/10 hover:bg-secondary-dark hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Tutor Image */}
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={tutor.image}
                              alt={tutor.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                            {matchingData && tutor.matchScore > 0 && index === 0 && (
                              <div className="absolute top-0 left-0 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br">
                                Top
                              </div>
                            )}
                          </div>
                          
                          {/* Tutor Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className={`font-bold text-base ${selectedTutor === tutor.id ? 'text-white' : 'text-white'}`}>
                                {tutor.name}
                              </h3>
                              <div className={`text-sm font-semibold whitespace-nowrap ${selectedTutor === tutor.id ? 'text-accent' : 'text-accent'}`}>
                                €{tutor.hourlyRate}/Std
                              </div>
                            </div>
                            
                            <p className="text-xs text-gray-400 mb-2 line-clamp-1">{tutor.bio}</p>
                            
                            {/* Subjects */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {tutor.subjects.slice(0, 3).map((subject) => (
                                <span
                                  key={subject}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    selectedTutor === tutor.id
                                      ? 'bg-accent/20 text-accent'
                                      : 'bg-accent/10 text-accent'
                                  }`}
                                >
                                  {subject}
                                </span>
                              ))}
                            </div>
                            {/* Languages (no icon) */}
                            <div className="flex flex-wrap gap-1 mb-2 text-[10px] text-gray-400">
                              {tutor.languages && tutor.languages.length > 0 && (
                                <span>{tutor.languages.join(', ')}</span>
                              )}
                            </div>
                            {/* Top Achievement */}
                            <div className="flex items-start gap-1 text-[11px] text-gray-500">
                              <Check className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{tutor.achievements[0]}</span>
                            </div>
                            
                            {/* Match Score */}
                            {matchingData && tutor.matchScore > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-secondary-dark rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="h-full bg-accent rounded-full transition-all"
                                    style={{ width: `${tutor.matchScore}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500">{Math.round(tutor.matchScore)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  {filteredTutors.length === 0 && (
                    <div className="text-center py-8 bg-secondary-dark/30 rounded-xl">
                      <p className="text-gray-400 text-sm">Keine Tutoren für dieses Fach verfügbar.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Package Selection */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Wähle ein Paket</h2>
              {hasExistingBookings && (
                <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-200 text-sm">
                  💡 Die kostenlose Probestunde ist nur für Neukunden verfügbar.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages
                  .filter(pkg => !hasExistingBookings || pkg.id !== 'trial')
                  .map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`p-6 rounded-xl text-left transition-all border-2 ${
                      selectedPackage === pkg.id
                        ? 'bg-accent text-white border-accent'
                        : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                    }`}
                  >
                    <div className="text-2xl font-bold mb-2">{pkg.name}</div>
                    <div className="text-3xl font-bold mb-2">€{pkg.price}</div>
                    {pkg.savings && (
                      <div className="text-sm text-green-400 mb-3">Spare €{pkg.savings}!</div>
                    )}
                    <ul className="space-y-1 text-sm">
                      {pkg.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Wähle Datum und Uhrzeit</h2>
              
              {/* Date Selection */}
              <div className="mb-6">
                <label className="block text-white font-semibold mb-2">Datum</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    // Reset time when date changes
                    setSelectedTime('');
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                />
              </div>

              {/* Time Selection - Only show if date is selected */}
              {selectedDate && (
                <div className="mb-6">
                  <label className="block text-white font-semibold mb-3">Verfügbare Uhrzeiten</label>
                  
                  {availableTimes.length === 0 ? (
                    <div className="p-6 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold mb-1">Keine Verfügbarkeit an diesem Tag</p>
                          <p className="text-sm">
                            {tutors.find(t => t.id === selectedTutor)?.name} hat am{' '}
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
                            keine verfügbaren Zeitslots. Bitte wähle ein anderes Datum.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {availableTimes.map(time => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setSelectedTime(time)}
                            className={`p-4 rounded-lg font-semibold transition-all border-2 ${
                              selectedTime === time
                                ? 'bg-accent text-white border-accent shadow-lg scale-105'
                                : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark hover:border-accent/50 border-white/20'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                      
                      {selectedTime && (
                        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-200 text-sm">
                            ✓ Ausgewählt: <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> um <strong>{selectedTime} Uhr</strong>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!selectedDate && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-200 text-sm">
                    💡 Wähle zuerst ein Datum, um die verfügbaren Uhrzeiten zu sehen
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Wo soll der Unterricht stattfinden?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedLocation('online')}
                  className={`p-8 rounded-xl transition-all border-2 ${
                    selectedLocation === 'online'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                  }`}
                >
                  <Monitor className="w-12 h-12 mx-auto mb-3" />
                  <div className="text-2xl font-bold mb-2">Online</div>
                  <p className="text-sm opacity-80">Via Zoom oder Google Meet</p>
                </button>
                <button
                  onClick={() => setSelectedLocation('in-person')}
                  className={`p-8 rounded-xl transition-all border-2 ${
                    selectedLocation === 'in-person'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                  }`}
                >
                  <Home className="w-12 h-12 mx-auto mb-3" />
                  <div className="text-2xl font-bold mb-2">Vor Ort</div>
                  <p className="text-sm opacity-80">In München oder Umgebung</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Contact Info */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Kontaktinformationen</h2>
              {user ? (
                // Logged-in users: Show confirmation message only
                <div className="space-y-4">
                  <div className="p-6 bg-accent/10 border border-accent/30 rounded-xl">
                    <p className="text-white text-center">
                      ✓ Du bist eingeloggt als <strong>{user.email}</strong>
                    </p>
                    <p className="text-gray-400 text-sm text-center mt-2">
                      Deine Kontaktdaten werden automatisch verwendet.
                    </p>
                  </div>
                  
                  {!user.user_metadata?.name && (
                    <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
                      <p className="text-yellow-200 text-sm">
                        ⚠️ <strong>Kein Name hinterlegt:</strong> Bitte gehe nach der Buchung zu <strong>Dashboard → Profil</strong> und trage deinen Namen ein, damit er bei zukünftigen Buchungen verwendet wird.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Non-logged-in users: Show full contact form
                <div className="space-y-4">
                  <div>
                    <label className="block text-white font-semibold mb-2">Name *</label>
                    <input
                      type="text"
                      value={contactInfo.name}
                      onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})}
                      className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="Dein vollständiger Name"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">E-Mail *</label>
                    <input
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                      className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="deine@email.de"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Telefon</label>
                    <input
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                      className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="+49 ..."
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Nachricht (optional)</label>
                    <textarea
                      value={contactInfo.message}
                      onChange={(e) => setContactInfo({...contactInfo, message: e.target.value})}
                      rows={4}
                      className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                      placeholder="Besondere Wünsche oder Anmerkungen..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </FrostedCard>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-primary-dark/95 backdrop-blur-md border-t border-white/10 p-4 z-50">
          <div className="max-w-4xl mx-auto flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0 || isSubmitting}
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Zurück
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isReschedule ? 'Wird umgebucht...' : 'Wird gebucht...'}
                </>
              ) : (
                <>
                  {currentStep === bookingSteps.length - 1 
                    ? (isReschedule ? 'Umbuchung abschließen' : 'Buchung abschließen')
                    : 'Weiter'
                  }
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
