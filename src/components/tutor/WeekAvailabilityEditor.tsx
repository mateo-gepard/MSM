'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface WeekAvailabilityEditorProps {
  tutorName: string;
  defaultAvailability: Array<{ day: string; times: string[] }>;
  onSave: (weekKey: string, availability: Array<{ day: string; times: string[] }>) => Promise<void>;
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_IDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Time windows as requested
const TIME_WINDOWS = [
  { id: 'morning', name: 'Morgens', start: '08:00', end: '13:00', times: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'] },
  { id: 'vormittag', name: 'Vormittags', start: '13:00', end: '16:00', times: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'] },
  { id: 'afternoon', name: 'Nachmittags', start: '16:00', end: '19:00', times: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30'] },
  { id: 'evening', name: 'Abends', start: '19:00', end: '22:00', times: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] }
];

export function WeekAvailabilityEditor({ tutorName, defaultAvailability, onSave }: WeekAvailabilityEditorProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [weekAvailability, setWeekAvailability] = useState<Record<string, Array<{ day: string; times: string[] }>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load saved week availabilities from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWeekData = localStorage.getItem('weekAvailability');
      if (savedWeekData) {
        try {
          const parsed = JSON.parse(savedWeekData);
          setWeekAvailability(parsed);
          console.log('📅 Loaded week availabilities from localStorage:', Object.keys(parsed).length, 'weeks');
        } catch (error) {
          console.error('Failed to parse saved week availabilities:', error);
        }
      }
    }
  }, []);

  // Get week key (YYYY-WW format)
  const getWeekKey = (date: Date): string => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const weekNumber = Math.ceil(diff / oneWeek);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  const currentWeekKey = getWeekKey(currentWeekStart);

  // Get availability for current week (or default)
  const getCurrentWeekAvailability = (): Array<{ day: string; times: string[] }> => {
    if (weekAvailability[currentWeekKey]) {
      return weekAvailability[currentWeekKey];
    }
    // Return default availability
    return defaultAvailability;
  };

  const currentAvailability = getCurrentWeekAvailability();

  // Check if a day/time window is selected
  const isWindowSelected = (dayId: string, windowId: string): boolean => {
    const dayAvailability = currentAvailability.find(a => a.day === dayId);
    if (!dayAvailability) return false;
    
    const window = TIME_WINDOWS.find(w => w.id === windowId);
    if (!window) return false;
    
    // Check if ALL times in the window are selected
    return window.times.every(time => dayAvailability.times.includes(time));
  };

  // Toggle a time window
  const toggleWindow = (dayId: string, windowId: string) => {
    const window = TIME_WINDOWS.find(w => w.id === windowId);
    if (!window) return;

    const newAvailability = [...currentAvailability];
    const dayIndex = newAvailability.findIndex(a => a.day === dayId);
    
    const isCurrentlySelected = isWindowSelected(dayId, windowId);

    if (dayIndex === -1) {
      // Day doesn't exist, add it
      if (!isCurrentlySelected) {
        newAvailability.push({ day: dayId, times: [...window.times] });
      }
    } else {
      // Day exists, toggle times
      if (isCurrentlySelected) {
        // Remove all times from this window
        newAvailability[dayIndex].times = newAvailability[dayIndex].times.filter(
          time => !window.times.includes(time)
        );
      } else {
        // Add all times from this window
        const existingTimes = newAvailability[dayIndex].times;
        const newTimes = [...new Set([...existingTimes, ...window.times])].sort();
        newAvailability[dayIndex].times = newTimes;
      }
    }

    // Update week availability
    setWeekAvailability(prev => ({
      ...prev,
      [currentWeekKey]: newAvailability
    }));
  };

  // Navigate weeks
  const previousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    
    // Don't allow going to past weeks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOfThisWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    mondayOfThisWeek.setDate(today.getDate() + diff);
    
    if (newStart >= mondayOfThisWeek) {
      setCurrentWeekStart(newStart);
    }
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const canGoPrevious = (): boolean => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOfThisWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    mondayOfThisWeek.setDate(today.getDate() + diff);
    
    return newStart >= mondayOfThisWeek;
  };

  // Save availability
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSave(currentWeekKey, currentAvailability);
      setSaveMessage('✓ Verfügbarkeit gespeichert!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save availability:', error);
      setSaveMessage('✗ Fehler beim Speichern');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  const isUsingDefault = !weekAvailability[currentWeekKey];

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={previousWeek}
          disabled={!canGoPrevious()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            canGoPrevious()
              ? 'bg-white/5 text-white hover:bg-white/10'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Vorherige Woche</span>
        </button>

        <div className="text-white font-semibold text-center">
          <div className="text-sm text-gray-400">Woche vom</div>
          <div className="text-lg">
            {weekDays[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} - {weekDays[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {isUsingDefault && (
            <div className="text-xs text-blue-400 mt-1">
              (Standard-Verfügbarkeit)
            </div>
          )}
        </div>

        <button
          onClick={nextWeek}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all"
        >
          <span className="hidden sm:inline">Nächste Woche</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stundenplan Grid */}
      <div className="bg-secondary-dark/50 rounded-xl p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {DAY_NAMES.map((dayName, dayIndex) => {
            const dayId = DAY_IDS[dayIndex];
            return (
              <div key={dayId} className="space-y-2">
                <div className="text-white font-semibold text-sm sm:text-base">
                  {dayName}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_WINDOWS.map(window => {
                    const isSelected = isWindowSelected(dayId, window.id);
                    return (
                      <motion.button
                        key={window.id}
                        onClick={() => toggleWindow(dayId, window.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          p-3 rounded-lg transition-all border-2 text-sm font-medium
                          ${isSelected
                            ? 'bg-green-500/30 text-green-200 border-green-500/50'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                          }
                        `}
                      >
                        <div className="font-semibold">{window.name}</div>
                        <div className="text-xs opacity-75">{window.start} - {window.end}</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Speichern...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Verfügbarkeit speichern
            </>
          )}
        </Button>

        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`text-sm font-medium ${
              saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {saveMessage}
          </motion.div>
        )}
      </div>

      {isUsingDefault && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-200 text-sm">
            💡 <strong>Standard-Verfügbarkeit aktiv</strong> - Klicke auf die Zeitfenster, um die Verfügbarkeit für diese Woche anzupassen. Nicht gesetzte Wochen verwenden automatisch deine Standard-Verfügbarkeit.
          </p>
        </div>
      )}
    </div>
  );
}
