'use client';

import { Tutor } from '@/types';
import { FrostedCard } from '../ui/FrostedCard';
import { Award, Clock } from 'lucide-react';
import Image from 'next/image';

interface TutorCardProps {
  tutor: Tutor;
  onSelect?: (tutor: Tutor) => void;
}

export function TutorCard({ tutor, onSelect }: TutorCardProps) {
  const handleClick = () => {
    if (onSelect) {
      console.log('Tutor selected:', tutor.name, tutor.id);
      onSelect(tutor);
    }
  };

  return (
    <div 
      className={onSelect ? 'cursor-pointer' : ''}
      onClick={onSelect ? handleClick : undefined}
    >
      <FrostedCard 
        className={`group transition-all ${onSelect ? 'hover:shadow-xl hover:shadow-accent/20 hover:scale-[1.02]' : ''}`}
      >
        <div className="relative h-48 w-full mb-4 rounded-xl overflow-hidden">
          <Image
            src={tutor.image}
            alt={tutor.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-opacity duration-500 group-hover:opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/80 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl font-bold text-white mb-1">{tutor.name}</h3>
            <div className="flex items-center gap-2 text-accent text-sm font-semibold">
              <span>€{tutor.hourlyRate}/Std</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Subjects */}
          <div className="flex flex-wrap gap-2">
            {tutor.subjects.map((subject) => (
              <span
                key={subject}
                className="px-3 py-1 bg-accent/20 text-accent rounded-full text-xs font-medium"
              >
                {subject}
              </span>
            ))}
          </div>

          {/* Bio */}
          <p className="text-sm text-gray-300 line-clamp-2">{tutor.bio}</p>

          {/* Achievements */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-accent text-xs">
              <Award className="w-4 h-4" />
              <span className="font-semibold">Auszeichnungen:</span>
            </div>
            <ul className="space-y-1">
              {tutor.achievements.slice(0, 2).map((achievement, idx) => (
                <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span className="line-clamp-1">{achievement}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <span>{tutor.languages.join(', ')}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{tutor.availability}</span>
            </div>
          </div>
        </div>

        {onSelect && (
          <div className="mt-4 w-full py-2 bg-accent/10 text-accent rounded-lg text-sm font-semibold text-center">
            Klicken zum Auswählen ➜
          </div>
        )}
      </FrostedCard>
    </div>
  );
}

