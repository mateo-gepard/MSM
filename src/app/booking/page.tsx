'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { createBooking, rescheduleBooking } from '@/lib/calcom';
import { getUserBookings, saveBookingToSupabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import { tutors, packages, subjects } from '@/data/mockData';
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle, Monitor, Home } from 'lucide-react';
import { TutorCard } from '@/components/tutors/TutorCard';

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('bookingStep');
    return stepParam ? parseInt(stepParam) : 0;
  });
  const [matchingData, setMatchingData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Dynamically determine booking steps based on whether user came from matching
  const getBookingSteps = () => {
    const hasLocation = matchingData?.location;
    return hasLocation 
      ? ['Fach & Tutor', 'Service', 'Termin'] // Skip location if from matching
      : ['Fach & Tutor', 'Service', 'Termin', 'Ort'];
  };
  
  const bookingSteps = getBookingSteps();
  
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
  const [bookingHistoryLoaded, setBookingHistoryLoaded] = useState(false);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [cameFromMatching, setCameFromMatching] = useState(false); // Track if user came from matching wizard

  // Sync currentStep with URL using pushState for proper browser history
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('bookingStep', currentStep.toString());
    window.history.pushState({ bookingStep: currentStep }, '', url.toString());
  }, [currentStep]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stepParam = new URLSearchParams(window.location.search).get('bookingStep');
      if (stepParam) {
        setCurrentStep(parseInt(stepParam));
      } else if (event.state?.bookingStep !== undefined) {
        setCurrentStep(event.state.bookingStep);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect to login if user is not authenticated (except when loading)
  useEffect(() => {
    if (!loading && !user) {
      // Save current booking data to localStorage before redirect
      const bookingData = {
        subject: selectedSubject,
        tutor: selectedTutor,
        package: selectedPackage,
        date: selectedDate,
        time: selectedTime,
        location: selectedLocation
      };
      
      if (selectedSubject || selectedTutor) {
        localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
        console.log('💾 Saved pending booking data before login redirect');
      }
      
      // Redirect to login with return URL
      router.push('/login?redirect=/booking&message=login-required');
    }
  }, [loading, user, router, selectedSubject, selectedTutor, selectedPackage, selectedDate, selectedTime, selectedLocation]);

  // First useEffect: Handle reschedule and matching data (doesn't need user)
  useEffect(() => {
    // Restore pending booking data after login
    const pendingBooking = localStorage.getItem('pendingBooking');
    if (pendingBooking && user) {
      try {
        const data = JSON.parse(pendingBooking);
        if (data.subject) setSelectedSubject(data.subject);
        if (data.tutor) setSelectedTutor(data.tutor);
        if (data.package) setSelectedPackage(data.package);
        if (data.date) setSelectedDate(data.date);
        if (data.time) setSelectedTime(data.time);
        if (data.location) setSelectedLocation(data.location);
        
        // Clear the pending booking
        localStorage.removeItem('pendingBooking');
        console.log('✅ Restored pending booking data after login');
      } catch (error) {
        console.error('Failed to restore pending booking:', error);
      }
    }
    
    // Load matching data from wizard if available
    const stored = localStorage.getItem('matchingData');
    if (stored) {
      const data = JSON.parse(stored);
      setMatchingData(data);
      setCameFromMatching(true); // Mark that user came from matching
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

      // If tutor was selected in matching wizard, pre-select it
      if (data.selectedTutor) {
        setSelectedTutor(data.selectedTutor);
        console.log('Auto-selected tutor from matching:', data.selectedTutor);
      }

      // If location was selected in matching wizard, pre-select it
      if (data.location) {
        setSelectedLocation(data.location as 'online' | 'in-person');
        console.log('Auto-selected location from matching:', data.location);
      }
    }

    // Check for package param from pricing section
    const pkgParam = searchParams.get('package');
    if (pkgParam) {
      setSelectedPackage(pkgParam);
    }
  }, [searchParams]);

  // Second useEffect: Check booking history (NEEDS user to be loaded)
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
    
    // Check if user has existing bookings - load from Supabase AND localStorage
    const checkBookingHistory = async () => {
      if (!user?.id) {
        setBookingHistoryLoaded(true);
        setHasExistingBookings(false);
        return;
      }
      
      let allBookings: any[] = [];
      
      // Try to load from Supabase first
      try {
        const supabaseBookings = await getUserBookings(user.id);
        if (supabaseBookings && supabaseBookings.length > 0) {
          allBookings = supabaseBookings;
        }
      } catch (error) {
        console.error('⚠️ Failed to load bookings from Supabase:', error);
      }
      
      // Also check localStorage as fallback
      const storageKey = `userBookings_${user.id}`;
      const storedBookings = localStorage.getItem(storageKey);
      
      if (storedBookings) {
        try {
          const localBookings = JSON.parse(storedBookings);
          // If Supabase had no bookings, use localStorage
          if (allBookings.length === 0) {
            allBookings = localBookings;
          }
        } catch (error) {
          console.error('⚠️ Failed to load bookings from localStorage:', error);
        }
      }
      
      // Count ALL bookings (including cancelled) to prevent trial booking abuse
      if (allBookings.length > 0) {
        setHasExistingBookings(true);
        console.log('🚫 Trial booking blocked: User has', allBookings.length, 'existing booking(s)');
      } else {
        setHasExistingBookings(false);
        console.log('✅ Trial booking allowed: No existing bookings');
      }
      
      setBookingHistoryLoaded(true);
    };
    
    checkBookingHistory();
  }, [user, searchParams]); // Run when user changes or searchParams change

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
    const hasLocation = matchingData?.location; // Check if location is pre-selected from matching
    
    switch (currentStep) {
      case 0: return selectedSubject && selectedTutor;
      case 1: {
        // Block trial package if user has existing bookings
        if (selectedPackage === 'trial' && hasExistingBookings) {
          return false;
        }
        return selectedPackage;
      }
      case 2: return selectedDate && selectedTime;
      case 3: return hasLocation || selectedLocation; // If from matching, location is already set
      default: return false;
    }
  };

  const handleNext = () => {
    const hasLocation = matchingData?.location; // Location pre-selected from matching
    
    // If on step 2 (date/time) and location is already set, skip to submission
    if (currentStep === 2 && hasLocation) {
      handleSubmit();
    }
    // Normal flow: proceed to next step
    else if (currentStep < bookingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
    // Last step: submit booking
    else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setBookingError(null);

    try {
      // ⚠️ CRITICAL VALIDATION: Block trial bookings for users with existing bookings
      if (selectedPackage === 'trial') {
        // Block if user is not logged in
        if (!user?.id) {
          throw new Error('Bitte melde dich an, um eine Probestunde zu buchen.');
        }
        
        // Check Supabase first
        let hasBookings = false;
        try {
          const supabaseBookings = await getUserBookings(user.id);
          if (supabaseBookings && supabaseBookings.length > 0) {
            hasBookings = true;
          }
        } catch (error) {
          console.warn('⚠️ Could not check Supabase bookings:', error);
        }
        
        // Also check localStorage as fallback
        if (!hasBookings) {
          const storageKey = `userBookings_${user.id}`;
          const storedBookings = localStorage.getItem(storageKey);
          if (storedBookings) {
            const localBookings = JSON.parse(storedBookings);
            if (localBookings.length > 0) {
              hasBookings = true;
            }
          }
        }
        
        if (hasBookings) {
          throw new Error('Die Probestunde ist nur für Neukunden verfügbar. Du hast bereits eine Buchungshistorie.');
        }
      }
      
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
            tutorName: selectedTutorData.name,
            packageId: selectedPackage,
            subject: selectedSubject,
            location: selectedLocation,
            phone: contactInfo.phone
          },
          userId: user?.id // Pass Supabase User ID for synchronization
        });
        console.log('Booking created successfully:', bookingResult);
        console.log('Cal.com Booking ID:', bookingResult?.id || bookingResult?.booking?.id || bookingResult?.data?.id);
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
        // Try to extract Cal.com booking ID from multiple possible locations
        const calcomBookingId = String(bookingResult?.id || 
                                bookingResult?.booking?.id || 
                                bookingResult?.data?.id ||
                                bookingResult?.uid ||
                                `booking_${Date.now()}`);
        
        console.log('Storing booking with ID:', calcomBookingId);
        console.log('Is Cal.com ID:', !calcomBookingId.startsWith('booking_'));
        
        const newBooking = {
          ...bookingData,
          id: calcomBookingId,
          calcomBookingId: calcomBookingId.startsWith('booking_') ? null : calcomBookingId, // Store separately for clarity
          status: 'scheduled',
          createdAt: new Date().toISOString()
        };
        
        existingBookings.push(newBooking);
        localStorage.setItem(storageKey, JSON.stringify(existingBookings));
        
        // Note: Booking is already saved to Supabase in calcom.ts createBooking()
        // No need to save again here to avoid duplicate key errors
        
        // Also save booking for tutor dashboard access
        const tutorBookingsKey = 'allTutorBookings';
        const allTutorBookings = JSON.parse(localStorage.getItem(tutorBookingsKey) || '{}');
        if (!allTutorBookings[selectedTutor]) {
          allTutorBookings[selectedTutor] = [];
        }
        allTutorBookings[selectedTutor].push({
          id: calcomBookingId,
          parentName: contactInfo.name || user?.user_metadata?.name || user?.email || 'Elternteil',
          parentEmail: contactInfo.email || user?.email || '',
          parentId: user?.id,
          subject: selectedSubject,
          date: selectedDate,
          time: selectedTime,
          location: selectedLocation,
          status: 'scheduled',
          message: contactInfo.message,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(tutorBookingsKey, JSON.stringify(allTutorBookings));
      }

      // Clear matching data
      localStorage.removeItem('matchingData');

      // Redirect to dashboard
      router.push(`/dashboard?${isReschedule ? 'rescheduleSuccess' : 'bookingSuccess'}=true`);
    } catch (error) {
      console.error('Booking failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      // If trial booking is rejected, scroll to package selection and highlight the error
      if (errorMessage.includes('Probestunde') || errorMessage.includes('Neukunden')) {
        setCurrentStep(1); // Go back to package selection step
        setBookingError(`⚠️ ${errorMessage}`);
      } else {
        setBookingError(`Buchung fehlgeschlagen: ${errorMessage}`);
      }
      
      setIsSubmitting(false);
    }
  };

  // Get available times based on tutor's availability settings
  const getAvailableTimes = (): string[] => {
    if (!selectedDate || !selectedTutor) {
      return [];
    }

    // Get the day of week from the selected date
    const date = new Date(selectedDate + 'T00:00:00');
    const daysMap: { [key: number]: string } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const dayOfWeek = daysMap[date.getDay()];

    // Check for saved tutor availability from localStorage
    let tutorAvailability: { day: string; times: string[] }[] | null = null;
    
    if (typeof window !== 'undefined') {
      // First check tutor-specific saved availability
      const savedAvailability = localStorage.getItem(`tutorAvailability_${selectedTutor}`);
      if (savedAvailability) {
        tutorAvailability = JSON.parse(savedAvailability);
      } else {
        // Check global availability store
        const globalAvailability = localStorage.getItem('tutorAvailabilities');
        if (globalAvailability) {
          const allAvailabilities = JSON.parse(globalAvailability);
          if (allAvailabilities[selectedTutor]) {
            tutorAvailability = allAvailabilities[selectedTutor];
          }
        }
      }
    }

    // If tutor has saved availability, use it
    if (tutorAvailability && tutorAvailability.length > 0) {
      const daySlot = tutorAvailability.find(slot => slot.day === dayOfWeek);
      if (daySlot && daySlot.times.length > 0) {
        return daySlot.times.sort();
      }
      // Tutor has availability set but not for this day
      return [];
    }

    // Fall back to tutor's default availableSlots from tutor data
    const tutor = tutors.find(t => t.id === selectedTutor);
    if (tutor?.availableSlots) {
      const daySlot = tutor.availableSlots.find(slot => slot.day === dayOfWeek);
      if (daySlot && daySlot.times.length > 0) {
        return daySlot.times.sort();
      }
      // Tutor has default slots but not for this day
      return [];
    }

    // Ultimate fallback: all times available (for tutors without any availability set)
    return [
      '09:00', '10:00', '11:00', '12:00', 
      '13:00', '14:00', '15:00', '16:00', 
      '17:00', '18:00', '19:00', '20:00'
    ];
  };

  const availableTimes = getAvailableTimes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-24 sm:pt-32 pb-24 sm:pb-32">
      <div className="container mx-auto px-3 sm:px-4 max-w-5xl">
        {/* Reschedule Banner */}
        {isReschedule && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-200 flex items-start gap-2 sm:gap-3"
          >
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Buchung umbuchen 📅</p>
              <p className="text-xs sm:text-sm">
                Du bist dabei, deine bestehende Buchung umzubuchen. Ändere die gewünschten Details und bestätige am Ende.
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Matching Banner */}
        {cameFromMatching && matchingData && selectedSubject && currentStep === 0 && !isReschedule && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-accent/20 border border-accent/50 rounded-xl text-white flex items-start gap-2 sm:gap-3"
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Matching abgeschlossen! ✨</p>
              <p className="text-xs sm:text-sm">
                Basierend auf deinen Präferenzen haben wir {filteredTutors.length} passende Tutoren für <strong>{selectedSubject}</strong> gefunden. 
                Sie sind nach Übereinstimmung sortiert!
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Tutor Selected Banner */}
        {selectedTutor && currentStep > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200 flex items-start gap-2 sm:gap-3"
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Tutor ausgewählt! ✨</p>
              <p className="text-xs sm:text-sm">
                Du hast <strong>{tutors.find(t => t.id === selectedTutor)?.name}</strong> für <strong>{selectedSubject}</strong> ausgewählt.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Banner */}
        {bookingError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 flex items-start gap-2 sm:gap-3"
          >
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm sm:text-base">Fehler</p>
              <p className="text-xs sm:text-sm">{bookingError}</p>
            </div>
          </motion.div>
        )}

        {/* Progress */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between">
            {bookingSteps.map((step, idx) => (
              <div key={idx} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${idx < bookingSteps.length - 1 ? 'flex-1' : ''}`}>
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all text-sm sm:text-base ${
                      currentStep >= idx
                        ? 'bg-accent text-white'
                        : 'bg-secondary-dark/50 text-gray-400'
                    }`}
                  >
                    {currentStep > idx ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : idx + 1}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2 hidden sm:block">{step}</span>
                </div>
                {idx < bookingSteps.length - 1 && (
                  <div className="flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2">
                    <div className={`h-full rounded ${
                      currentStep > idx ? 'bg-accent' : 'bg-secondary-dark/50'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <FrostedCard className="p-4 sm:p-8" hover={false}>
          {/* Step 0: Subject & Tutor */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Wähle Fach und Tutor</h2>
              
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
                    {subjects.map(subject => (
                      <option key={subject.name} value={subject.name}>{subject.name}</option>
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
              
              {/* Loading state while checking booking history */}
              {!bookingHistoryLoaded && (
                <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                    <div className="text-yellow-200">
                      Prüfe Buchungshistorie...
                    </div>
                  </div>
                </div>
              )}
              
              {bookingHistoryLoaded && hasExistingBookings && (
                <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-blue-200 font-semibold mb-1">
                        Probestunde nicht verfügbar
                      </div>
                      <div className="text-blue-300 text-sm">
                        Die kostenlose Probestunde ist nur für Neukunden verfügbar. 
                        Du hast bereits eine Buchungshistorie (auch stornierte Buchungen zählen).
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages
                  .filter(pkg => {
                    // Filter out trial if user has existing bookings
                    if (pkg.id === 'trial' && bookingHistoryLoaded && hasExistingBookings) {
                      return false;
                    }
                    return true;
                  })
                  .map(pkg => {
                    // Disable trial package if still loading or if user has bookings
                    const isTrialDisabled = pkg.id === 'trial' && (!bookingHistoryLoaded || hasExistingBookings);
                    
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => {
                          if (!isTrialDisabled) {
                            setSelectedPackage(pkg.id);
                          }
                        }}
                        disabled={!bookingHistoryLoaded || isTrialDisabled}
                        className={`p-6 rounded-xl text-left transition-all border-2 ${
                          selectedPackage === pkg.id
                            ? 'bg-accent text-white border-accent'
                            : isTrialDisabled
                            ? 'bg-gray-800/30 text-gray-600 border-gray-600/30 opacity-50 cursor-not-allowed'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        } ${!bookingHistoryLoaded ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        <div className="text-2xl font-bold mb-2">{pkg.name}</div>
                        <div className="text-3xl font-bold mb-2">€{pkg.price}</div>
                        {pkg.savings && (
                          <div className="text-sm text-green-400 mb-3">Spare €{pkg.savings}!</div>
                        )}
                        {pkg.id === 'trial' && isTrialDisabled && (
                          <div className="text-sm text-red-400 mb-3">Nur für Neukunden</div>
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
                    );
                  })}
              </div>
              
              {/* Additional info card removed since trial is now shown as disabled in the main grid */}
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
                  
                  {availableTimes.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                  ) : (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-200 text-sm">
                        ⚠️ Der gewählte Tutor ist an diesem Tag nicht verfügbar. Bitte wähle ein anderes Datum.
                      </p>
                      <p className="text-yellow-200/70 text-xs mt-2">
                        {tutors.find(t => t.id === selectedTutor)?.availability || 'Verfügbarkeit nicht angegeben'}
                      </p>
                    </div>
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
                  <div className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Online</div>
                  <p className="text-xs sm:text-sm opacity-80">Via Zoom oder Google Meet</p>
                </button>
                {(() => {
                  const selectedTutorData = tutors.find(t => t.id === selectedTutor);
                  const isOnlineOnly = selectedTutorData?.onlineOnly;
                  
                  return (
                    <button
                      onClick={() => !isOnlineOnly && setSelectedLocation('in-person')}
                      disabled={isOnlineOnly}
                      className={`p-5 sm:p-8 rounded-xl transition-all border-2 active:scale-[0.98] ${
                        isOnlineOnly
                          ? 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed opacity-50'
                          : selectedLocation === 'in-person'
                          ? 'bg-accent text-white border-accent'
                          : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                      }`}
                    >
                      <Home className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3" />
                      <div className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Vor Ort</div>
                      <p className="text-xs sm:text-sm opacity-80">
                        {isOnlineOnly 
                          ? 'Nicht verfügbar für diesen Tutor'
                          : 'In München oder Umgebung'
                        }
                      </p>
                    </button>
                  );
                })()}
              </div>
            </div>
          )}
        </FrostedCard>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-primary-dark/95 backdrop-blur-md border-t border-white/10 p-3 sm:p-4 z-50">
          <div className="max-w-4xl mx-auto flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0 || isSubmitting}
              className="flex-1 sm:flex-none py-3 sm:py-2"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Zurück</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className="flex-1 sm:flex-none py-3 sm:py-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 animate-spin" />
                  <span className="text-sm">{isReschedule ? 'Umbuchen...' : 'Buchen...'}</span>
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base">
                    {currentStep === bookingSteps.length - 1 
                      ? (isReschedule ? 'Abschließen' : 'Buchen')
                      : 'Weiter'
                    }
                  </span>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
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
