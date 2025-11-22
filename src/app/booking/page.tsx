'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createBooking, rescheduleBooking } from '@/lib/calcom';
import { motion } from 'framer-motion';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { Button } from '@/components/ui/Button';
import { tutors, packages } from '@/data/mockData';
import { ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { TutorCard } from '@/components/tutors/TutorCard';

const bookingSteps = [
  'Fach & Tutor',
  'Service',
  'Termin',
  'Ort',
  'Kontakt'
];

export default function BookingPage() {
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
    if (rescheduleId) {
      setIsReschedule(true);
      setRescheduleBookingId(rescheduleId);
      
      // Load the booking to reschedule
      const storedBookings = localStorage.getItem('userBookings');
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
    const storedBookings = localStorage.getItem('userBookings');
    if (storedBookings) {
      try {
        const bookings = JSON.parse(storedBookings);
        setHasExistingBookings(bookings.length > 0);
      } catch (error) {
        console.error('Failed to load bookings:', error);
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
      case 2: return selectedDate && selectedTime;
      case 3: return selectedLocation;
      case 4: return contactInfo.name && contactInfo.email;
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
            name: contactInfo.name || user?.email || 'Anonymous',
            email: contactInfo.email || user?.email || '',
            notes: `${selectedPackageData.name} - ${selectedSubject}\n${contactInfo.message || ''}`
          },
          metadata: {
            tutorId: selectedTutor,
            packageId: selectedPackage
          }
        });
        console.log('Booking created successfully:', bookingResult);
      }
      
      // Store booking data in localStorage for dashboard display
      const existingBookings = JSON.parse(localStorage.getItem('userBookings') || '[]');
      
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
        localStorage.setItem('userBookings', JSON.stringify(updatedBookings));
        
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
        localStorage.setItem('userBookings', JSON.stringify(existingBookings));
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

  const availableTimes = [
    '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', 
    '17:00', '18:00', '19:00'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-20">
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

        <FrostedCard className="p-8">
          {/* Step 0: Subject & Tutor */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Wähle Fach und Tutor</h2>
              
              {/* Subject Selection */}
              <div className="mb-8">
                <label className="block text-white font-semibold mb-3">Fach</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedTutor(''); // Reset tutor when subject changes
                  }}
                  className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                >
                  <option value="">Fach auswählen...</option>
                  {Array.from(new Set(tutors.flatMap(t => t.subjects))).map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              {/* Tutor Selection */}
              {selectedSubject && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-white font-semibold">
                      Verfügbare Tutoren
                      {matchingData && (
                        <span className="ml-2 text-sm text-gray-400">
                          (Sortiert nach bester Übereinstimmung)
                        </span>
                      )}
                    </label>
                    <div className="text-sm text-gray-400">
                      {filteredTutors.length} {filteredTutors.length === 1 ? 'Tutor' : 'Tutoren'}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTutors.map((tutor, index) => (
                      <div
                        key={tutor.id}
                        className="relative"
                      >
                        {/* Match Badge */}
                        {matchingData && tutor.matchScore > 0 && index < 3 && (
                          <div className="absolute -top-2 -right-2 z-10 bg-accent text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                            {index === 0 ? '🏆 Top Match' : `#${index + 1} Match`}
                          </div>
                        )}
                        
                        <div
                          className={`h-full transition-all ${
                            selectedTutor === tutor.id ? 'ring-4 ring-accent rounded-xl' : ''
                          }`}
                        >
                          <TutorCard 
                            tutor={tutor} 
                            onSelect={(t) => setSelectedTutor(t.id)}
                          />
                        </div>
                        
                        {/* Match Score Indicator */}
                        {matchingData && tutor.matchScore > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                            <div className="flex-1 bg-secondary-dark/50 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-accent rounded-full transition-all"
                                style={{ width: `${tutor.matchScore}%` }}
                              />
                            </div>
                            <span>{Math.round(tutor.matchScore)}% Match</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {filteredTutors.length === 0 && (
                    <div className="text-center py-12 bg-secondary-dark/30 rounded-xl">
                      <p className="text-gray-400">Keine Tutoren für dieses Fach verfügbar.</p>
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
                    className={`p-6 rounded-xl text-left transition-all ${
                      selectedPackage === pkg.id
                        ? 'bg-accent text-white scale-105'
                        : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark'
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-semibold mb-2">Datum</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white font-semibold mb-2">Uhrzeit</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full p-3 rounded-lg bg-secondary-dark text-white border border-accent/30 focus:border-accent outline-none"
                  >
                    <option value="">Uhrzeit wählen...</option>
                    {availableTimes.map(time => (
                      <option key={time} value={time}>{time} Uhr</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-4">
                * Die Verfügbarkeit wird nach Auswahl automatisch geprüft
              </p>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Wo soll der Unterricht stattfinden?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedLocation('online')}
                  className={`p-8 rounded-xl transition-all ${
                    selectedLocation === 'online'
                      ? 'bg-accent text-white scale-105'
                      : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark'
                  }`}
                >
                  <div className="text-4xl mb-3">💻</div>
                  <div className="text-2xl font-bold mb-2">Online</div>
                  <p className="text-sm opacity-80">Via Zoom oder Google Meet</p>
                </button>
                <button
                  onClick={() => setSelectedLocation('in-person')}
                  className={`p-8 rounded-xl transition-all ${
                    selectedLocation === 'in-person'
                      ? 'bg-accent text-white scale-105'
                      : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark'
                  }`}
                >
                  <div className="text-4xl mb-3">🏠</div>
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
            </div>
          )}
        </FrostedCard>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
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
  );
}
