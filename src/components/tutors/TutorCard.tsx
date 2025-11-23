'use client';

import { Tutor } from '@/types';
import { FrostedCard } from '../ui/FrostedCard';
import { Award, Clock } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

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
    <motion.div 
      className={onSelect ? 'cursor-pointer' : ''}
      onClick={onSelect ? handleClick : undefined}
      whileHover={onSelect ? { scale: 1.03, y: -5 } : {}}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <FrostedCard 
        className={`group transition-all ${onSelect ? 'hover:shadow-2xl hover:shadow-accent/30' : ''}`}
      >
        <div className="relative h-48 w-full mb-4 rounded-xl overflow-hidden">
          <Image
            src={tutor.image}
            alt={tutor.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-dark/90 via-primary-dark/40 to-transparent transition-opacity duration-300 group-hover:opacity-80" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-accent transition-colors duration-300">{tutor.name}</h3>
            <div className="flex items-center gap-2 text-accent text-sm font-semibold">
              <span className="px-2 py-0.5 bg-accent/20 rounded-full backdrop-blur-sm">€{tutor.hourlyRate}/Std</span>
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
          <motion.div 
            className="mt-4 w-full py-2 bg-gradient-to-r from-accent/10 to-accent/20 text-accent rounded-lg text-sm font-semibold text-center group-hover:from-accent group-hover:to-accent group-hover:text-white transition-all duration-300"
            whileHover={{ scale: 1.02 }}
          >
            Klicken zum Auswählen ➜
          </motion.div>
        )}
      </FrostedCard>
    </motion.div>
  );
}

