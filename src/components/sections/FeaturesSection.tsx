'use client';

import { motion } from 'framer-motion';
import { Target, Users, MessageCircle, Calendar, Trophy, Globe } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'Personalisierte Lernpläne',
    description: 'Jeder Schüler erhält einen individuellen Lernplan, abgestimmt auf seine Ziele und Bedürfnisse.'
  },
  {
    icon: Trophy,
    title: 'Olympiade-Niveau',
    description: 'Unsere Tutoren sind selbst Wettbewerbs-Sieger und kennen die Anforderungen höchster Standards.'
  },
  {
    icon: Users,
    title: '1:1 Betreuung',
    description: 'Intensive Einzelbetreuung für maximalen Lernerfolg – keine Gruppenunterricht.'
  },
  {
    icon: Globe,
    title: 'Bilingualer Unterricht',
    description: 'Unterricht auf Deutsch, Englisch oder anderen Sprachen für internationale Perspektiven.'
  },
  {
    icon: Calendar,
    title: 'Flexible Buchung',
    description: 'Online-Buchungssystem mit Echtzeit-Verfügbarkeit und einfacher Terminverwaltung.'
  },
  {
    icon: MessageCircle,
    title: 'Direkte Kommunikation',
    description: 'Integriertes Messaging-System für schnellen Austausch mit deinem Tutor.'
  }
];

export function FeaturesSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-primary-dark to-secondary-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Warum Elite Tutoring?
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Mehr als nur Nachhilfe – eine einzigartige Lernerfahrung
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="frosted-glass rounded-2xl p-8 transition-colors duration-300"
            >
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <feature.icon className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
