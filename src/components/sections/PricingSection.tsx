'use client';

import { motion } from 'framer-motion';
import { packages } from '@/data/mockData';
import { PricingCard } from '../pricing/PricingCard';
import { useRouter } from 'next/navigation';

export function PricingSection() {
  const router = useRouter();

  const handleSelectPackage = (pkg: any) => {
    router.push(`/booking?package=${pkg.id}`);
  };

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-secondary-dark to-primary-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Faire & Transparente Preise
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Quality over Quantity – Limitierte Stunden pro Woche für maximalen Lernerfolg
          </p>
        </motion.div>

        <div className="w-full flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((pkg, idx) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <PricingCard package={pkg} onSelect={handleSelectPackage} />
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center mt-12"
        >
          <p className="text-sm text-gray-400">
            * Probestunde nur für Neukunden verfügbar
          </p>
        </motion.div>
      </div>
    </section>
  );
}
