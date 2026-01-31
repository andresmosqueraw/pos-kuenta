'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CardHoverEffectProps = {
  title: string;
  description: string;
  icon: ReactNode;
  variant: string;
  glowEffect?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showGridLines?: boolean;
};

export function CardHoverEffect({
  title,
  description,
  icon,
  variant,
  glowEffect = false,
  size = 'md',
  showGridLines = false,
}: CardHoverEffectProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card p-6 transition-all duration-300 hover:shadow-lg',
        variant === 'rose' && 'border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700',
        size === 'lg' && 'p-8',
        glowEffect && 'hover:shadow-rose-500/25',
      )}
    >
      {showGridLines && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.2) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      )}
      <div className="relative z-10">
        <div className="mb-4 h-8 w-8 text-rose-600">{icon}</div>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
