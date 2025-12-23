'use client';

import React from 'react';
import { LucideIcon, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ColorVariant = 'purple' | 'cyan' | 'blue' | 'green' | 'yellow' | 'orange' | 'pink' | 'indigo' | 'teal' | 'red';
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

// Color configurations for cards
const colorConfig: Record<ColorVariant, {
  card: string;
  icon: string;
  iconBg: string;
}> = {
  purple: {
    card: 'bg-gradient-to-br from-purple-600/20 to-purple-900/20 border-purple-500/30 hover:border-purple-400/50',
    icon: 'text-purple-400',
    iconBg: 'bg-purple-600/20'
  },
  cyan: {
    card: 'bg-gradient-to-br from-cyan-600/20 to-cyan-900/20 border-cyan-500/30 hover:border-cyan-400/50',
    icon: 'text-cyan-400',
    iconBg: 'bg-cyan-600/20'
  },
  blue: {
    card: 'bg-gradient-to-br from-blue-600/20 to-blue-900/20 border-blue-500/30 hover:border-blue-400/50',
    icon: 'text-blue-400',
    iconBg: 'bg-blue-600/20'
  },
  green: {
    card: 'bg-gradient-to-br from-green-600/20 to-green-900/20 border-green-500/30 hover:border-green-400/50',
    icon: 'text-green-400',
    iconBg: 'bg-green-600/20'
  },
  yellow: {
    card: 'bg-gradient-to-br from-yellow-600/20 to-yellow-900/20 border-yellow-500/30 hover:border-yellow-400/50',
    icon: 'text-yellow-400',
    iconBg: 'bg-yellow-600/20'
  },
  orange: {
    card: 'bg-gradient-to-br from-orange-600/20 to-orange-900/20 border-orange-500/30 hover:border-orange-400/50',
    icon: 'text-orange-400',
    iconBg: 'bg-orange-600/20'
  },
  pink: {
    card: 'bg-gradient-to-br from-pink-600/20 to-pink-900/20 border-pink-500/30 hover:border-pink-400/50',
    icon: 'text-pink-400',
    iconBg: 'bg-pink-600/20'
  },
  red: {
    card: 'bg-gradient-to-br from-red-600/20 to-red-900/20 border-red-500/30 hover:border-red-400/50',
    icon: 'text-red-400',
    iconBg: 'bg-red-600/20'
  },
  indigo: {
    card: 'bg-gradient-to-br from-indigo-600/20 to-indigo-900/20 border-indigo-500/30 hover:border-indigo-400/50',
    icon: 'text-indigo-400',
    iconBg: 'bg-indigo-600/20'
  },
  teal: {
    card: 'bg-gradient-to-br from-teal-600/20 to-teal-900/20 border-teal-500/30 hover:border-teal-400/50',
    icon: 'text-teal-400',
    iconBg: 'bg-teal-600/20'
  },
};

// Status badge configurations
const statusConfig: Record<Status, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  'coming-soon': { variant: 'secondary', label: 'Coming Soon' },
  upgrade: { variant: 'outline', label: 'Upgrade' },
};

/**
 * TileCard - Built on shadcn Card with custom color variants
 * Used for action tiles throughout the app (Settings, Integrations, etc.)
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
        'group relative transition-all duration-200',
        colors.card,
        isActive
          ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl'
          : 'cursor-not-allowed opacity-60',
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
      <CardHeader className="p-4">
        {/* Icon and Status Badge Row */}
        <div className="flex items-start justify-between mb-2">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            isActive ? colors.iconBg : 'bg-gray-700/50'
          )}>
            <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-gray-500')} />
          </div>
          <Badge variant={statusInfo.variant} className="text-xs">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Title and Description */}
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>

      {/* Hover Overlay */}
      {isActive && (
        <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={onClick}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            aria-label={`Configure ${title}`}
          >
            <Settings className="h-4 w-4" />
            Configure
          </button>
        </div>
      )}
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
        'group relative transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-xl',
        colors.card,
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
      <CardHeader className="p-4">
        {/* Icon */}
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', colors.iconBg)}>
          <Icon className="h-5 w-5 text-foreground" />
        </div>

        {/* Title and Description */}
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={onClick}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          aria-label={`Configure ${title}`}
        >
          <Settings className="h-4 w-4" />
          Configure
        </button>
      </div>
    </Card>
  );
}
