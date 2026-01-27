'use client';

import { motion } from 'framer-motion';
import { tutors } from '@/data/mockData';
import { TutorCard } from '../tutors/TutorCard';

export function TutorsSection() {
  return (
    <section id="tutors" className="py-16 sm:py-24 bg-gradient-to-b from-primary-dark to-secondary-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Unsere Tutoren
          </h2>
          <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto px-2">
            Jeder Tutor ist ein Experte auf seinem Gebiet mit nachweisbaren Erfolgen 
            auf nationalen und internationalen Wettbewerben.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
          {tutors.slice(0, 6).map((tutor, idx) => (
            <motion.div
              key={tutor.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
            >
              <TutorCard tutor={tutor} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
