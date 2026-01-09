'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Award, Target, Heart, Users, Sparkles, TrendingUp, ArrowRight, Check, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useRef } from 'react';

export default function UberUnsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const values = [
    {
      icon: Award,
      title: 'Exzellenz',
      description: 'Unsere Tutoren gehören zu den besten Schülern Deutschlands mit über 100 ersten Preisen bei nationalen und internationalen Wettbewerben.',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Heart,
      title: 'Leidenschaft',
      description: 'Wir brennen für unsere Fächer und geben diese Begeisterung an unsere Schüler weiter. Lernen soll Spaß machen.',
      color: 'from-red-500 to-pink-500'
    },
    {
      icon: Target,
      title: 'Individualität',
      description: 'Jeder Schüler ist einzigartig. Wir passen unseren Unterricht an jeden Lerntyp, jedes Tempo und jedes Ziel an.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: TrendingUp,
      title: 'Messbare Erfolge',
      description: 'Wir setzen auf konkrete Fortschritte: bessere Noten, tieferes Verständnis und mehr Selbstvertrauen in die eigenen Fähigkeiten.',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const stats = [
    { number: '1.0', label: 'Durchschnittsnote unserer Tutoren', suffix: '' },
    { number: '100', label: 'Erste Preise bei Wettbewerben', suffix: '+' },
    { number: '6', label: 'Hochqualifizierte Elite-Tutoren', suffix: '' },
    { number: '5', label: 'Sprachen im Team', suffix: '' }
  ];

  const journey = [
    { 
      step: '01',
      title: 'Kennenlernen',
      description: 'Du wählst deinen Tutor basierend auf Fach, Ziel und Lernstil.',
      icon: Users
    },
    { 
      step: '02',
      title: 'Erste Session',
      description: 'Wir analysieren deine Stärken, Schwächen und definieren klare Ziele.',
      icon: Target
    },
    { 
      step: '03',
      title: 'Maßgeschneiderter Plan',
      description: 'Dein Tutor entwickelt einen individuellen Lernplan für maximalen Fortschritt.',
      icon: Sparkles
    },
    { 
      step: '04',
      title: 'Kontinuierlicher Erfolg',
      description: 'Regelmäßige Sessions, messbare Fortschritte und nachhaltige Verbesserung.',
      icon: TrendingUp
    }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-primary-dark overflow-x-hidden">
      {/* Hero Section with Parallax */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-1/4 -left-20 w-96 h-96 bg-accent rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ opacity: 0.15 }}
          />
          <motion.div
            className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.4, 1],
              x: [0, -50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            style={{ opacity: 0.15 }}
          />
        </div>

        <motion.div 
          className="container mx-auto px-4 sm:px-6 md:px-8 relative z-10 text-center py-20 sm:py-0"
          style={{ opacity, scale }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-6 sm:mb-8 leading-tight px-2"
          >
            Über{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-purple-400 to-pink-400">
              MSM
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-300 mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed px-4"
          >
            Munich Scholar Mentors – Elite 1:1 Mentoring<br className="hidden sm:block" />
            <span className="sm:hidden"> </span>von außergewöhnlichen jungen Talenten
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4"
          >
            <Link href="/matching" className="w-full sm:w-auto">
              <Button size="lg" className="group w-full sm:w-auto">
                Jetzt starten
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/#tutors" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Tutoren kennenlernen
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Journey Timeline */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-primary-dark via-secondary-dark to-primary-dark relative">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16 lg:mb-20"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 px-4">
              Deine Reise zu <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">Spitzenleistungen</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto px-4">
              In 4 Schritten zum nachhaltigen Lernerfolg
            </p>
          </motion.div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute left-6 sm:left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent via-purple-500 to-pink-500" />

            {journey.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative mb-12 sm:mb-16 md:mb-24 last:mb-0 flex items-center ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Step Number Circle */}
                <div className="absolute left-6 sm:left-8 md:left-1/2 md:-translate-x-1/2 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-accent to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-accent/50 z-10">
                  <span className="text-lg sm:text-2xl font-bold text-white">{item.step}</span>
                </div>

                {/* Content Card */}
                <div className={`ml-20 sm:ml-24 md:ml-0 md:w-5/12 ${index % 2 === 0 ? 'md:mr-auto md:pr-20' : 'md:ml-auto md:pl-20'}`}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="frosted-glass rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-accent/40 transition-all group"
                  >
                    <item.icon className="w-10 h-10 sm:w-12 sm:h-12 text-accent mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{item.title}</h3>
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed">{item.description}</p>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section with Bento Grid */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-primary-dark to-secondary-dark">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 text-accent mx-auto mb-4 sm:mb-6" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 px-4">
              Warum MSM?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Large Featured Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 lg:row-span-2 frosted-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 sm:mb-6">
                  Unsere Mission
                </h3>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4 sm:mb-6">
                  MSM wurde gegründet, um außergewöhnlichen Schülern eine Plattform zu bieten, 
                  ihr Wissen und ihre Begeisterung weiterzugeben. Wir glauben daran, dass die besten 
                  Lehrer nicht nur fachlich exzellent sind, sondern auch die Sprache der Schüler sprechen.
                </p>
                <div className="space-y-3 sm:space-y-4">
                  {[
                    'Olympiade-Preisträger als Mentoren',
                    'Peer-to-Peer Lernatmosphäre',
                    'Individuelle Lernpläne',
                    'Messbare Fortschritte'
                  ].map((point, i) => (
                    <motion.div
                      key={point}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-2 sm:gap-3"
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
                      </div>
                      <span className="text-sm sm:text-base text-gray-300">{point}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Small Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="frosted-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:border-accent/40 transition-all group"
            >
              <Award className="w-10 h-10 sm:w-12 sm:h-12 text-accent mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">Überqualifiziert</h4>
              <p className="text-sm sm:text-base text-gray-300">
                Nicht einfach gute Schüler – Preisträger internationaler Wettbewerbe und Frühstudenten.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="frosted-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:border-accent/40 transition-all group"
            >
              <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-accent mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
              <h4 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">Nahbar</h4>
              <p className="text-sm sm:text-base text-gray-300">
                Geringer Altersunterschied = entspannte Atmosphäre und echtes Verständnis für deine Situation.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Cards */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-secondary-dark to-primary-dark">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 px-4">
              Unsere Werte
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                whileHover={{ y: -10 }}
                className="frosted-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 relative overflow-hidden group"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${value.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
                <div className="relative z-10">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${value.color} opacity-20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform`}>
                    <value.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{value.title}</h3>
                  <p className="text-sm sm:text-base text-gray-300 leading-relaxed">{value.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats with Counter Animation */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-primary-dark via-secondary-dark to-primary-dark relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 px-4">
              MSM in Zahlen
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="frosted-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-purple-500/0 group-hover:from-accent/10 group-hover:to-purple-500/10 transition-all duration-500" />
                <div className="relative z-10">
                  <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400 mb-2 sm:mb-3">
                    {stat.number}{stat.suffix}
                  </div>
                  <div className="text-xs sm:text-sm lg:text-base text-gray-300 leading-snug">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-primary-dark to-secondary-dark">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl"
          >
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-purple-500/20 to-pink-500/20" />
            <div className="absolute inset-0 frosted-glass" />
            
            {/* Animated Orbs */}
            <motion.div
              className="absolute top-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6">
                  Bereit durchzustarten?
                </h2>
                <p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-2">
                  Finde deinen perfekten Tutor und erlebe, wie Lernen mit den Besten <span className="text-accent font-semibold">Spaß macht</span> und <span className="text-accent font-semibold">echte Fortschritte</span> bringt.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <Link href="/matching" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto group text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6">
                      Jetzt Tutor finden
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/#pricing" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6">
                      Preise ansehen
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
