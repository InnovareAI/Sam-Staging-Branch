'use client';

import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ColorVariant = 'purple' | 'cyan' | 'blue' | 'green' | 'yellow' | 'orange' | 'pink' | 'indigo' | 'teal' | 'red' | 'primary';
type Status = 'active' | 'coming-soon' | 'upgrade';

interface TileCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color: ColorVariant;
  status?: Status;
  onClick?: () => void;
  className?: string;
}

// Color configurations - accent colors for icons and borders only
const colorConfig: Record<ColorVariant, {
  border: string;
  icon: string;
  iconBg: string;
}> = {
  purple: {
    border: 'hover:border-purple-500/50',
    icon: 'text-purple-500',
    iconBg: 'bg-purple-600/20'
  },
  cyan: {
    border: 'hover:border-cyan-500/50',
    icon: 'text-cyan-500',
    iconBg: 'bg-cyan-600/20'
  },
  blue: {
    border: 'hover:border-blue-500/50',
    icon: 'text-blue-500',
    iconBg: 'bg-blue-600/20'
  },
  green: {
    border: 'hover:border-green-500/50',
    icon: 'text-green-500',
    iconBg: 'bg-green-600/20'
  },
  yellow: {
    border: 'hover:border-yellow-500/50',
    icon: 'text-yellow-500',
    iconBg: 'bg-yellow-600/20'
  },
  orange: {
    border: 'hover:border-orange-500/50',
    icon: 'text-orange-500',
    iconBg: 'bg-orange-600/20'
  },
  pink: {
    border: 'hover:border-pink-500/50',
    icon: 'text-pink-500',
    iconBg: 'bg-pink-600/20'
  },
  red: {
    border: 'hover:border-red-500/50',
    icon: 'text-red-500',
    iconBg: 'bg-red-600/20'
  },
  indigo: {
    border: 'hover:border-indigo-500/50',
    icon: 'text-indigo-500',
    iconBg: 'bg-indigo-600/20'
  },
  teal: {
    border: 'hover:border-teal-500/50',
    icon: 'text-teal-500',
    iconBg: 'bg-teal-600/20'
  },
  primary: {
    border: 'hover:border-primary/50',
    icon: 'text-primary',
    iconBg: 'bg-primary/20'
  },
};

// Status badge configurations
const statusConfig: Record<Status, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  'coming-soon': { variant: 'secondary', label: 'Coming Soon' },
  upgrade: { variant: 'outline', label: 'Upgrade' },
};

/**
 * TileCard - Unified card style matching app-wide design
 * Uses surface-muted background with colored border highlights on hover
 */
export function TileCard({
  title,
  description,
  icon: Icon,
  color,
  status = 'active',
  onClick,
  className = '',
}: TileCardProps) {
  const isActive = status === 'active';
  const colors = colorConfig[color];
  const statusInfo = statusConfig[status];

  return (
    <Card
      onClick={isActive ? onClick : undefined}
      className={cn(
        'group relative bg-surface-muted border border-border rounded-xl transition-all duration-200',
        colors.border,
        'hover:bg-surface-muted/80',
        isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
        className
      )}
      role={isActive ? 'button' : undefined}
      tabIndex={isActive ? 0 : undefined}
      onKeyDown={(e) => {
        if (isActive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-disabled={!isActive}
    >
      <CardHeader className="p-5">
        {/* Icon and Status Badge Row */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isActive ? colors.iconBg : 'bg-gray-700/50'
          )}>
            <Icon className={cn('h-6 w-6', isActive ? colors.icon : 'text-gray-500')} />
          </div>
          {status !== 'active' && (
            <Badge variant={statusInfo.variant} className="text-xs">
              {statusInfo.label}
            </Badge>
          )}
        </div>

        {/* Title and Description */}
        <CardTitle className={cn(
          "text-lg text-foreground mb-1 transition-colors",
          isActive && `group-hover:${colors.icon}`
        )}>{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">{description}</CardDescription>

        {/* Action hint on hover */}
        {isActive && (
          <div className="mt-3 flex items-center gap-1 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <span className={colors.icon}>Open</span>
            <ArrowRight className={cn('h-4 w-4', colors.icon)} />
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

/**
 * SimpleTileCard - Minimal version for settings grids
 * No status badge, cleaner look
 */
export function SimpleTileCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
  className = '',
}: Omit<TileCardProps, 'status'>) {
  const colors = colorConfig[color];

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative bg-surface-muted border border-border rounded-xl transition-all duration-200 cursor-pointer',
        colors.border,
        'hover:bg-surface-muted/80',
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardHeader className="p-5">
        {/* Icon */}
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-3', colors.iconBg)}>
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>

        {/* Title and Description */}
        <CardTitle className="text-lg text-foreground mb-1">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed text-muted-foreground">{description}</CardDescription>

        {/* Action hint on hover */}
        <div className="mt-3 flex items-center gap-1 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <span className={colors.icon}>Open</span>
          <ArrowRight className={cn('h-4 w-4', colors.icon)} />
        </div>
      </CardHeader>
    </Card>
  );
}
