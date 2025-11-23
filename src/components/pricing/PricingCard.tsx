'use client';

import { Package } from '@/types';
import { FrostedCard } from '../ui/FrostedCard';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion } from 'framer-motion';

interface PricingCardProps {
  package: Package;
  onSelect?: (pkg: Package) => void;
}

export function PricingCard({ package: pkg, onSelect }: PricingCardProps) {
  return (
    <motion.div
      whileHover={{ scale: pkg.popular ? 1.02 : 1.05, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <FrostedCard 
        className={`relative h-full flex flex-col ${pkg.popular ? 'ring-2 ring-accent shadow-2xl shadow-accent/30' : 'hover:shadow-xl hover:shadow-accent/20'}`}
      >
        {pkg.popular && (
          <motion.div 
            className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-accent to-purple-500 rounded-full flex items-center gap-1 shadow-lg"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-bold text-white">Beliebtestes</span>
          </motion.div>
        )}

        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">€{pkg.price}</span>
            {pkg.sessions > 1 && (
              <span className="text-gray-400 text-sm">/ {pkg.sessions} Std</span>
            )}
          </div>
          {pkg.savings && (
            <motion.p 
              className="text-sm text-green-400 mt-2 font-semibold"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              Spare €{pkg.savings}!
            </motion.p>
          )}
        </div>

      <ul className="space-y-3 mb-6 flex-grow">
        {pkg.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
            <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={pkg.popular ? 'primary' : 'outline'}
        className="w-full mt-auto"
        onClick={() => onSelect?.(pkg)}
      >
        {pkg.price === 0 ? 'Kostenlos testen' : 'Jetzt buchen'}
      </Button>
    </FrostedCard>
    </motion.div>
  );
}
