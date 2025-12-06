
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { subjects, tutors } from '@/data/mockData';
import { Button } from '@/components/ui/Button';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { useAuth } from '@/hooks/useAuth';
import { 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  Brain, 
  Clock, 
  Languages,
  BookOpen,
  CheckCircle,
  Sparkles,
  MapPin,
  Monitor
} from 'lucide-react';
import * as Icons from 'lucide-react';

const goals = [
  { id: 'olympiad', name: 'Wettbewerbsvorbereitung', icon: 'Trophy' },
  { id: 'grades', name: 'Notenverbesserung', icon: 'TrendingUp' },
  { id: 'passion', name: 'Begeisterung wecken', icon: 'Sparkles' },
  { id: 'exam', name: 'Prüfungsvorbereitung', icon: 'FileText' },
  { id: 'challenge', name: 'Herausforderung suchen', icon: 'Zap' }
];

const learningStyles = [
  { id: 'visual', name: 'Visuell', description: 'Durch Bilder, Diagramme, Videos', icon: 'Eye' },
  { id: 'auditory', name: 'Auditiv', description: 'Durch Gespräche und Erklärungen', icon: 'Ear' },
  { id: 'kinesthetic', name: 'Praktisch', description: 'Durch Übungen und Experimente', icon: 'Hand' },
  { id: 'reading', name: 'Lesen/Schreiben', description: 'Durch Texte und Notizen', icon: 'BookOpen' }
];

const urgencies = [
  { id: 'immediate', name: 'Sofort', description: 'Innerhalb von 1-2 Wochen', icon: 'Zap' },
  { id: 'soon', name: 'Bald', description: 'Innerhalb eines Monats', icon: 'Calendar' },
  { id: 'flexible', name: 'Flexibel', description: 'Kein fester Zeitrahmen', icon: 'Clock' }
];

const languages = [
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'Englisch' },
  { id: 'es', name: 'Spanisch' },
  { id: 'fr', name: 'Französisch' }
];

const locationOptions = [
  { id: 'online', name: 'Online', description: 'Unterricht per Video-Call', icon: 'Monitor' },
  { id: 'in-person', name: 'Präsenz', description: 'Persönlicher Unterricht vor Ort', icon: 'Users' }
];

const steps = [
  { id: 1, title: 'Fächerauswahl', icon: BookOpen },
  { id: 2, title: 'Ziel', icon: Target },
  { id: 3, title: 'Lernstil', icon: Brain },
  { id: 4, title: 'Zeitrahmen', icon: Clock },
  { id: 5, title: 'Sprache', icon: Languages },
  { id: 6, title: 'Ort', icon: MapPin },
  { id: 7, title: 'Ergebnis', icon: CheckCircle }
];

export default function MatchingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(() => {
    const stepParam = searchParams.get('step');
    return stepParam ? parseInt(stepParam) : 1;
  });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedLearningStyle, setSelectedLearningStyle] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(''); // online or in-person
  const [selectedTutor, setSelectedTutor] = useState<string>('');

  // Sync currentStep with URL using pushState for proper browser history
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', currentStep.toString());
    window.history.pushState({ step: currentStep }, '', url.toString());
  }, [currentStep]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stepParam = new URLSearchParams(window.location.search).get('step');
      if (stepParam) {
        setCurrentStep(parseInt(stepParam));
      } else if (event.state?.step) {
        setCurrentStep(event.state.step);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const toggleLanguage = (langId: string) => {
    setSelectedLanguages(prev =>
      prev.includes(langId)
        ? prev.filter(id => id !== langId)
        : [...prev, langId]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedSubjects.length > 0;
      case 2: return selectedGoals.length > 0;
      case 3: return selectedLearningStyle !== '';
      case 4: return selectedUrgency !== '';
      case 5: return selectedLanguages.length > 0;
      case 6: return selectedLocation !== '';
      case 7: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    } else {
      const matchingData = {
        subjects: selectedSubjects,
        goals: selectedGoals,
        learningStyle: selectedLearningStyle,
        urgency: selectedUrgency,
        languages: selectedLanguages,
        location: selectedLocation, // Save location preference
        selectedTutor: selectedTutor // Save selected tutor for booking wizard
      };
      localStorage.setItem('matchingData', JSON.stringify(matchingData));
      
      if (!user) {
        router.push('/login?redirect=/booking&fromMatching=true');
      } else {
        router.push('/booking?fromMatching=true');
      }
    }
  };

  const getRecommendedTutors = () => {
    const subjectNames = selectedSubjects.map(id => 
      subjects.find(s => s.id === id)?.name
    ).filter(Boolean);
    
    return tutors.filter(tutor => {
      // Filter by subject
      const hasMatchingSubject = tutor.subjects.some(subject => subjectNames.includes(subject));
      
      // Filter by location: if in-person is selected, exclude online-only tutors
      const locationMatch = selectedLocation === 'in-person' ? !tutor.onlineOnly : true;
      
      return hasMatchingSubject && locationMatch;
    }).slice(0, 3);
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="w-6 h-6" /> : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-24 sm:pt-32 pb-12 sm:pb-20">
      <div className="container mx-auto px-3 sm:px-4 max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}>
                  <div
                    className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.id
                        ? 'bg-accent text-white scale-100 sm:scale-110'
                        : 'bg-secondary-dark/50 text-gray-400'
                    }`}
                  >
                    <step.icon className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2 hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2">
                    <div className={`h-full rounded transition-all duration-300 ${
                      currentStep > step.id ? 'bg-accent' : 'bg-secondary-dark/50'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FrostedCard className="p-4 sm:p-8" hover={false}>
              {/* Step 1: Subjects */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 text-center">Welche Fächer interessieren dich?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-center text-sm sm:text-base">Wähle ein oder mehrere Fächer aus</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 max-w-3xl mx-auto">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => toggleSubject(subject.id)}
                        className={`p-4 sm:p-6 rounded-xl transition-colors duration-300 border-2 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[120px] active:scale-95 ${
                          selectedSubjects.includes(subject.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{getIcon(subject.icon)}</div>
                        <div className="font-semibold text-center text-xs sm:text-base">{subject.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Goals */}
              {currentStep === 2 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Was ist dein Ziel?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Mehrfachauswahl möglich</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`p-4 sm:p-6 rounded-xl transition-colors duration-300 text-left border-2 active:scale-[0.98] ${
                          selectedGoals.includes(goal.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-xl sm:text-2xl">{getIcon(goal.icon)}</div>
                          <div className="font-semibold text-sm sm:text-base">{goal.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Learning Style */}
              {currentStep === 3 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Wie lernst du am besten?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Wähle deinen bevorzugten Lernstil</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {learningStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedLearningStyle(style.id)}
                        className={`p-4 sm:p-6 rounded-xl transition-colors duration-300 text-left border-2 active:scale-[0.98] ${
                          selectedLearningStyle === style.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="text-xl sm:text-2xl mt-0.5 sm:mt-1">{getIcon(style.icon)}</div>
                          <div>
                            <div className="font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">{style.name}</div>
                            <div className="text-xs sm:text-sm opacity-80">{style.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Urgency */}
              {currentStep === 4 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Wie dringend brauchst du Unterstützung?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Wähle deinen Zeitrahmen</p>
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {urgencies.map((urgency) => (
                      <button
                        key={urgency.id}
                        onClick={() => setSelectedUrgency(urgency.id)}
                        className={`p-4 sm:p-6 rounded-xl transition-colors duration-300 text-left border-2 active:scale-[0.98] ${
                          selectedUrgency === urgency.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-2xl sm:text-3xl">{getIcon(urgency.icon)}</div>
                          <div>
                            <div className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">{urgency.name}</div>
                            <div className="text-xs sm:text-sm opacity-80">{urgency.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Languages */}
              {currentStep === 5 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">In welcher Sprache möchtest du lernen?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Mehrfachauswahl möglich</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => toggleLanguage(lang.id)}
                        className={`p-4 sm:p-6 rounded-xl transition-colors duration-300 border-2 active:scale-95 ${
                          selectedLanguages.includes(lang.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        {/* Removed language icon for premium minimal look */}
                        <div className="font-semibold text-sm sm:text-base">{lang.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 6: Location Preference */}
              {currentStep === 6 && (
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">Wo möchtest du lernen?</h2>
                  <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Wähle deinen bevorzugten Unterrichtsort</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {locationOptions.map((location) => (
                      <button
                        key={location.id}
                        onClick={() => setSelectedLocation(location.id)}
                        className={`p-5 sm:p-8 rounded-xl transition-colors duration-300 text-left border-2 active:scale-[0.98] ${
                          selectedLocation === location.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="text-2xl sm:text-3xl mt-0.5 sm:mt-1">{getIcon(location.icon)}</div>
                          <div>
                            <div className="font-semibold text-lg sm:text-xl mb-1 sm:mb-2">{location.name}</div>
                            <div className="text-xs sm:text-sm opacity-80">{location.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 7: Results */}
              {currentStep === 7 && (
                <div>
                  <div className="text-center mb-6 sm:mb-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent/20 mb-3 sm:mb-4"
                    >
                      <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-accent" />
                    </motion.div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 sm:mb-2">Perfekte Matches gefunden!</h2>
                    <p className="text-gray-400 text-sm sm:text-base">Basierend auf deinen Angaben empfehlen wir diese Tutoren:</p>
                  </div>

                  {/* Recommended Tutors */}
                  <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                    {getRecommendedTutors().map((tutor, index) => (
                      <motion.div
                        key={tutor.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedTutor(tutor.id)}
                        className={`rounded-xl p-4 sm:p-6 border-2 cursor-pointer transition-all duration-300 active:scale-[0.98] ${
                          selectedTutor === tutor.id
                            ? 'bg-accent/20 border-accent shadow-lg shadow-accent/20'
                            : 'bg-secondary-dark/50 border-accent/20 hover:border-accent/40 hover:bg-secondary-dark/70'
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden flex-shrink-0">
                            <img src={tutor.image} alt={tutor.name} className="w-full h-full object-cover" />
                            {selectedTutor === tutor.id && (
                              <div className="absolute inset-0 bg-accent/40 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 sm:mb-1">{tutor.name}</h3>
                            {/* <p className="text-accent text-sm font-semibold mb-2">€{tutor.hourlyRate}/Std</p> */}
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                              {tutor.subjects.map((subject, idx) => (
                                <span key={idx} className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-accent/20 text-accent text-[10px] sm:text-xs rounded-lg">
                                  {subject}
                                </span>
                              ))}
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm line-clamp-2">{tutor.bio}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <p className="text-center text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6">
                    {selectedTutor ? '✓ Tutor ausgewählt - Du kannst später noch ändern' : 'Wähle einen Tutor aus (optional)'}
                  </p>

                  {/* Summary */}
                  <div className="bg-primary-dark/50 rounded-xl p-4 sm:p-6 space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">Deine Auswahl:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-400">Fächer:</span>
                        <span className="text-white ml-2">
                          {selectedSubjects.map(id => subjects.find(s => s.id === id)?.name).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Ziele:</span>
                        <span className="text-white ml-2">
                          {selectedGoals.map(id => goals.find(g => g.id === id)?.name).join(', ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Lernstil:</span>
                        <span className="text-white ml-2">
                          {learningStyles.find(ls => ls.id === selectedLearningStyle)?.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Zeitrahmen:</span>
                        <span className="text-white ml-2">
                          {urgencies.find(u => u.id === selectedUrgency)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </FrostedCard>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6 sm:mt-8 gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
                className="flex-1 sm:flex-none py-3 sm:py-2"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Zurück</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 sm:flex-none py-3 sm:py-2"
              >
                <span className="text-sm sm:text-base">{currentStep === 7 ? 'Zur Buchung' : currentStep === 6 ? 'Ergebnis' : 'Weiter'}</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
