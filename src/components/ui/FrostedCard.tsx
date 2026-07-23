import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FrostedCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function FrostedCard({ children, className, hover = true }: FrostedCardProps) {
  return (
    <div
      className={cn(
        'quiet-card rounded-2xl p-6',
        hover && 'interactive-surface',
        className,
      )}
    >
      {children}
    </div>
  );
}
