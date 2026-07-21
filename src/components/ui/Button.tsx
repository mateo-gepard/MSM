import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#6e56cf] text-white hover:bg-[#745bd1]',
    secondary: 'border border-white/10 bg-[#181821] text-white hover:bg-[#20202b]',
    outline: 'border border-white/20 bg-transparent text-white hover:border-white/35 hover:bg-white/5',
  };

  const sizes = {
    sm: 'min-h-9 px-3.5 text-sm',
    md: 'min-h-11 px-5 text-sm',
    lg: 'min-h-12 px-6 text-base',
  };

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
