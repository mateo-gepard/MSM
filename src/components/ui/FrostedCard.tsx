'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface FrostedCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function FrostedCard({ children, className, hover = true }: FrostedCardProps) {
  return (
    <motion.div
      className={cn(
        'frosted-glass rounded-2xl p-6',
        hover && 'transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-accent/20',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
