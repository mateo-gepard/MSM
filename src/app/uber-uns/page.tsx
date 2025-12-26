'use client';

import { motion } from 'framer-motion';
import { Award, Target, Heart, Users, Sparkles, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function UberUnsPage() {
  const values = [
    {
      icon: Award,
      title: 'Exzellenz',
      description: 'Unsere Tutoren gehören zu den besten Schülern Deutschlands mit über 100 ersten Preisen bei nationalen und internationalen Wettbewerben.'
    },
    {
      icon: Heart,
      title: 'Leidenschaft',
      description: 'Wir brennen für unsere Fächer und geben diese Begeisterung an unsere Schüler weiter. Lernen soll Spaß machen.'
    },
    {
      icon: Target,
      title: 'Individualität',
      description: 'Jeder Schüler ist einzigartig. Wir passen unseren Unterricht an jeden Lerntyp, jedes Tempo und jedes Ziel an.'
    },
    {
      icon: TrendingUp,
      title: 'Messbare Erfolge',
      description: 'Wir setzen auf konkrete Fortschritte: bessere Noten, tieferes Verständnis und mehr Selbstvertrauen in die eigenen Fähigkeiten.'
    }
  ];

  const stats = [
    { number: '1.0', label: 'Durchschnittsnote unserer Tutoren' },
    { number: '100+', label: 'Erste Preise bei Wettbewerben' },
    { number: '6', label: 'Hochqualifizierte Elite-Tutoren' },
    { number: '5', label: 'Sprachen im Team' }
  ];

  return (
    <div className="min-h-screen bg-primary-dark">
      {/* Hero Section */}
      <section className="relative py-20 sm:py-32 overflow-hidden bg-gradient-to-br from-primary-dark via-secondary-dark to-primary-dark">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-accent rounded-full blur-3xl"
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
        </div>

        <div className="container mx-auto px-6 sm:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
              Über{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">
                MSM
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 mb-8">
              Munich Scholar Mentors – Elite 1:1 Mentoring von Olympiade-Siegern
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-secondary-dark to-primary-dark">
        <div className="container mx-auto px-6 sm:px-8 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Sparkles className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Unsere Mission
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
              MSM wurde gegründet, um außergewöhnlichen Schülern eine Plattform zu bieten, 
              ihr Wissen und ihre Begeisterung weiterzugeben. Wir glauben daran, dass die besten 
              Lehrer nicht nur fachlich exzellent sind, sondern auch die Sprache der Schüler sprechen – 
              weil sie selbst erst kürzlich genau dort waren, wo unsere Schüler heute stehen.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="frosted-glass rounded-2xl p-8 sm:p-12"
          >
            <h3 className="text-2xl font-bold text-white mb-4">
              Warum MSM anders ist
            </h3>
            <div className="space-y-4 text-gray-300">
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Überqualifizierte Mentoren:</strong> Unsere Tutoren sind nicht einfach gute Schüler – 
                sie sind Preisträger nationaler und internationaler Wettbewerbe, Frühstudenten und 
                leidenschaftliche Experten in ihren Fächern.
              </p>
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Peer-to-Peer Lernen:</strong> Der geringe Altersunterschied schafft eine 
                entspannte Lernatmosphäre. Unsere Tutoren erinnern sich noch genau an die Herausforderungen 
                des Schulalltags und können sich perfekt in ihre Schüler hineinversetzen.
              </p>
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Individuelle Betreuung:</strong> Kein standardisiertes Programm. 
                Jede Session wird auf die spezifischen Bedürfnisse, Ziele und den Lernstil des Schülers zugeschnitten.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-primary-dark to-secondary-dark">
        <div className="container mx-auto px-6 sm:px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Unsere Werte
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Was uns antreibt und wie wir arbeiten
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="frosted-glass rounded-2xl p-8 hover:border-accent/40 transition-colors"
              >
                <value.icon className="w-10 h-10 text-accent mb-4" />
                <h3 className="text-xl font-bold text-white mb-3">{value.title}</h3>
                <p className="text-gray-300 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-secondary-dark to-primary-dark">
        <div className="container mx-auto px-6 sm:px-8 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              MSM in Zahlen
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="frosted-glass rounded-2xl p-6 sm:p-8 text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold text-accent mb-2">
                  {stat.number}
                </div>
                <div className="text-sm sm:text-base text-gray-300">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-primary-dark to-secondary-dark">
        <div className="container mx-auto px-6 sm:px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Users className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Unser Team
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Lerne unsere Elite-Tutoren kennen – jeder ein Experte, jeder mit einzigartigen Stärken
            </p>
            <Link href="/#tutors">
              <Button size="lg">
                Tutoren kennenlernen
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-secondary-dark to-primary-dark">
        <div className="container mx-auto px-6 sm:px-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="frosted-glass rounded-2xl p-8 sm:p-12 text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Bereit durchzustarten?
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Finde deinen perfekten Tutor und erlebe, wie Lernen mit den Besten Spaß macht 
              und echte Fortschritte bringt.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/matching">
                <Button size="lg" className="w-full sm:w-auto">
                  Jetzt Tutor finden
                </Button>
              </Link>
              <Link href="/#pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Preise ansehen
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
