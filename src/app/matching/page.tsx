'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Sparkles
} from 'lucide-react';
import * as Icons from 'lucide-react';

const goals = [
  { id: 'olympiad', name: 'Olympiaden-Vorbereitung', icon: 'Trophy' },
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

const steps = [
  { id: 1, title: 'Fächerauswahl', icon: BookOpen },
  { id: 2, title: 'Ziel', icon: Target },
  { id: 3, title: 'Lernstil', icon: Brain },
  { id: 4, title: 'Zeitrahmen', icon: Clock },
  { id: 5, title: 'Sprache', icon: Languages },
  { id: 6, title: 'Ergebnis', icon: CheckCircle }
];

export default function MatchingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedLearningStyle, setSelectedLearningStyle] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

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
      case 6: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      const matchingData = {
        subjects: selectedSubjects,
        goals: selectedGoals,
        learningStyle: selectedLearningStyle,
        urgency: selectedUrgency,
        languages: selectedLanguages
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
    
    return tutors.filter(tutor => 
      tutor.subjects.some(subject => subjectNames.includes(subject))
    ).slice(0, 3);
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="w-6 h-6" /> : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}>
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.id
                        ? 'bg-accent text-white scale-110'
                        : 'bg-secondary-dark/50 text-gray-400'
                    }`}
                  >
                    <step.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-gray-400 mt-2 hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-1 mx-2">
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
            <FrostedCard className="p-8" hover={false}>
              {/* Step 1: Subjects */}
              {currentStep === 1 && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 text-center">Welche Fächer interessieren dich?</h2>
                  <p className="text-gray-400 mb-8 text-center">Wähle ein oder mehrere Fächer aus</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => toggleSubject(subject.id)}
                        className={`p-6 rounded-xl transition-colors duration-300 border-2 flex flex-col items-center justify-center min-h-[120px] ${
                          selectedSubjects.includes(subject.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="text-3xl mb-2">{getIcon(subject.icon)}</div>
                        <div className="font-semibold text-center">{subject.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Goals */}
              {currentStep === 2 && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Was ist dein Ziel?</h2>
                  <p className="text-gray-400 mb-8">Mehrfachauswahl möglich</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`p-6 rounded-xl transition-colors duration-300 text-left border-2 ${
                          selectedGoals.includes(goal.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{getIcon(goal.icon)}</div>
                          <div className="font-semibold">{goal.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Learning Style */}
              {currentStep === 3 && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Wie lernst du am besten?</h2>
                  <p className="text-gray-400 mb-8">Wähle deinen bevorzugten Lernstil</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {learningStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedLearningStyle(style.id)}
                        className={`p-6 rounded-xl transition-colors duration-300 text-left border-2 ${
                          selectedLearningStyle === style.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-2xl mt-1">{getIcon(style.icon)}</div>
                          <div>
                            <div className="font-semibold mb-1">{style.name}</div>
                            <div className="text-sm opacity-80">{style.description}</div>
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
                  <h2 className="text-3xl font-bold text-white mb-2">Wie dringend brauchst du Unterstützung?</h2>
                  <p className="text-gray-400 mb-8">Wähle deinen Zeitrahmen</p>
                  <div className="grid grid-cols-1 gap-4">
                    {urgencies.map((urgency) => (
                      <button
                        key={urgency.id}
                        onClick={() => setSelectedUrgency(urgency.id)}
                        className={`p-6 rounded-xl transition-colors duration-300 text-left border-2 ${
                          selectedUrgency === urgency.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{getIcon(urgency.icon)}</div>
                          <div>
                            <div className="font-semibold text-lg mb-1">{urgency.name}</div>
                            <div className="text-sm opacity-80">{urgency.description}</div>
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
                  <h2 className="text-3xl font-bold text-white mb-2">In welcher Sprache möchtest du lernen?</h2>
                  <p className="text-gray-400 mb-8">Mehrfachauswahl möglich</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => toggleLanguage(lang.id)}
                        className={`p-6 rounded-xl transition-colors duration-300 border-2 ${
                          selectedLanguages.includes(lang.id)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark border-white/20'
                        }`}
                      >
                        {/* Removed language icon for premium minimal look */}
                        <div className="font-semibold">{lang.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 6: Results */}
              {currentStep === 6 && (
                <div>
                  <div className="text-center mb-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.5 }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/20 mb-4"
                    >
                      <Sparkles className="w-10 h-10 text-accent" />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-white mb-2">Perfekte Matches gefunden!</h2>
                    <p className="text-gray-400">Basierend auf deinen Angaben empfehlen wir diese Tutoren:</p>
                  </div>

                  {/* Recommended Tutors */}
                  <div className="space-y-4 mb-8">
                    {getRecommendedTutors().map((tutor, index) => (
                      <motion.div
                        key={tutor.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-secondary-dark/50 rounded-xl p-6 border border-accent/20"
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                            <img src={tutor.image} alt={tutor.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-1">{tutor.name}</h3>
                            <p className="text-accent text-sm font-semibold mb-2">€{tutor.hourlyRate}/Std</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {tutor.subjects.map((subject, idx) => (
                                <span key={idx} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-lg">
                                  {subject}
                                </span>
                              ))}
                            </div>
                            <p className="text-gray-400 text-sm">{tutor.bio}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="bg-primary-dark/50 rounded-xl p-6 space-y-3">
                    <h3 className="text-lg font-semibold text-white mb-3">Deine Auswahl:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
            <div className="flex justify-between items-center mt-8">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Zurück
              </Button>
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                {currentStep === 6 ? 'Zur Buchung' : currentStep === 5 ? 'Ergebnis anzeigen' : 'Weiter'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
