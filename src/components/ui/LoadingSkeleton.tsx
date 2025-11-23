'use client';

import { motion } from 'framer-motion';

export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-gradient-to-r from-secondary-dark/50 via-secondary-dark/30 to-secondary-dark/50 rounded-lg ${className}`}
      animate={{
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        backgroundSize: '200% 100%',
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="frosted-glass rounded-2xl p-6 space-y-4">
      <LoadingSkeleton className="h-48 w-full" />
      <LoadingSkeleton className="h-6 w-3/4" />
      <LoadingSkeleton className="h-4 w-full" />
      <LoadingSkeleton className="h-4 w-5/6" />
      <div className="flex gap-2">
        <LoadingSkeleton className="h-8 w-20" />
        <LoadingSkeleton className="h-8 w-24" />
      </div>
    </div>
  );
}
