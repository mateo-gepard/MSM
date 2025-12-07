'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface WeekCalendarProps {
  tutorAvailability: Array<{ day: string; times: string[] }>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  selectedTime: string;
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_IDS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function WeekCalendar({ tutorAvailability, selectedDate, onSelectDate, onSelectTime, selectedTime }: WeekCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Generate array of dates for current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  // Check if a date has available slots (only green if times exist)
  const hasAvailability = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    // Convert JavaScript day (0=Sunday) to our DAY_IDS (0=Monday)
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const dayId = DAY_IDS[dayIndex];
    const dayAvailability = tutorAvailability.find(a => a.day === dayId);
    // Only return true if the day exists AND has actual time slots
    return !!(dayAvailability && Array.isArray(dayAvailability.times) && dayAvailability.times.length > 0);
  };

  // Get available times for selected date
  const getAvailableTimes = (dateString: string): string[] => {
    if (!dateString) return [];
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = date.getDay();
    // Convert JavaScript day (0=Sunday) to our DAY_IDS (0=Monday)
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const dayId = DAY_IDS[dayIndex];
    const dayAvailability = tutorAvailability.find(a => a.day === dayId);
    return dayAvailability?.times || [];
  };

  const availableTimes = getAvailableTimes(selectedDate);

  // Navigate to previous week
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

  // Navigate to next week
  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  // Check if we can go to previous week
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

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if a date is in the past
  const isPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

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
        </div>

        <button
          onClick={nextWeek}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all"
        >
          <span className="hidden sm:inline">Nächste Woche</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Week Days Grid */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {weekDays.map((date, index) => {
          const dateString = formatDate(date);
          const available = hasAvailability(date);
          const isSelected = dateString === selectedDate;
          const isTodayDate = isToday(date);
          const isPastDate = isPast(date);

          return (
            <motion.button
              key={dateString}
              onClick={() => !isPastDate && onSelectDate(dateString)}
              disabled={isPastDate}
              whileHover={!isPastDate ? { scale: 1.05 } : {}}
              whileTap={!isPastDate ? { scale: 0.95 } : {}}
              className={`
                relative p-3 sm:p-4 rounded-xl transition-all border-2
                ${isPastDate ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected 
                  ? 'bg-accent text-white border-accent shadow-lg' 
                  : available 
                    ? 'bg-green-500/20 text-white border-green-500/50 hover:bg-green-500/30' 
                    : 'bg-secondary-dark/50 text-gray-500 border-white/10 hover:bg-secondary-dark/70'
                }
                ${isTodayDate && !isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-primary-dark' : ''}
              `}
            >
              <div className="text-xs sm:text-sm font-medium mb-1 truncate">
                {DAY_NAMES[index]}
              </div>
              <div className="text-lg sm:text-2xl font-bold">
                {date.getDate()}
              </div>
              {available && !isPastDate && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400"></div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Time Slots - Show when date is selected */}
      {selectedDate && availableTimes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-white font-semibold text-lg">
            Verfügbare Zeiten für {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {availableTimes.map(time => (
              <motion.button
                key={time}
                onClick={() => onSelectTime(time)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  p-4 rounded-lg font-semibold transition-all border-2
                  ${selectedTime === time
                    ? 'bg-accent text-white border-accent shadow-lg'
                    : 'bg-secondary-dark/50 text-gray-300 hover:bg-secondary-dark hover:border-accent/50 border-white/20'
                  }
                `}
              >
                {time}
              </motion.button>
            ))}
          </div>

          {selectedTime && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-200 text-sm">
                ✓ Ausgewählt: <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> um <strong>{selectedTime} Uhr</strong>
              </p>
            </div>
          )}
        </motion.div>
      )}

      {selectedDate && availableTimes.length === 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-200 text-sm">
            ⚠️ Der gewählte Tutor ist an diesem Tag nicht verfügbar. Bitte wähle ein anderes Datum.
          </p>
        </div>
      )}

      {!selectedDate && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-200 text-sm">
            💡 Wähle einen Tag aus dem Kalender (grün = verfügbar)
          </p>
        </div>
      )}
    </div>
  );
}
