'use client';

import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent/90 hover:scale-105 hover:shadow-lg hover:shadow-accent/50',
    secondary: 'bg-secondary-dark text-white hover:bg-secondary-dark/90 hover:scale-105',
    outline: 'border-2 border-accent text-accent hover:bg-accent hover:text-white hover:scale-105'
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <motion.button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
