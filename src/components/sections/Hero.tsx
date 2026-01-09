'use client';

import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Award, Users, FileText, Globe } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight px-2"
          >
            Erstklassiges{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">
              1:1 Mentoring
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto px-4"
          >
            Hochqualifizierte Schüler und Studenten unterrichten dich individuell mit 
            maßgeschneiderten Lernplänen – online oder vor Ort, auf Wunsch auch bilingual.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4"
          >
            <Link href="/matching" className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto py-4 text-base">
                Kostenloses Erstgespräch
              </Button>
            </Link>
            <Link href="#tutors" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto py-4 text-base">
                Tutoren entdecken
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 md:gap-8 max-w-4xl mx-auto px-2"
          >
            <div className="frosted-glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <Award className="w-6 h-6 sm:w-8 sm:h-8 text-accent mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">100+</div>
              <div className="text-xs sm:text-sm text-gray-400">Erste Preise</div>
            </div>
            <div className="frosted-glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-accent mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">6</div>
              <div className="text-xs sm:text-sm text-gray-400">Elite-Tutoren</div>
            </div>
            <div className="frosted-glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-accent mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">1.0</div>
              <div className="text-xs sm:text-sm text-gray-400">Notenschnitt</div>
            </div>
            <div className="frosted-glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-accent mx-auto mb-1 sm:mb-2" />
              <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">5</div>
              <div className="text-xs sm:text-sm text-gray-400">Sprachen</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
