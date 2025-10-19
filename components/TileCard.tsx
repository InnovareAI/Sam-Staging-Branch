'use client';

import React from 'react';
import { LucideIcon, Settings } from 'lucide-react';

type ColorVariant = 'purple' | 'cyan' | 'blue' | 'green' | 'yellow' | 'orange' | 'pink' | 'indigo' | 'teal';
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

const colorClasses: Record<ColorVariant, string> = {
  purple: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 hover:border-purple-400/50',
  cyan: 'from-cyan-600/20 to-cyan-900/20 border-cyan-500/30 hover:border-cyan-400/50',
  blue: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 hover:border-blue-400/50',
  green: 'from-green-600/20 to-green-900/20 border-green-500/30 hover:border-green-400/50',
  yellow: 'from-yellow-600/20 to-yellow-900/20 border-yellow-500/30 hover:border-yellow-400/50',
  orange: 'from-orange-600/20 to-orange-900/20 border-orange-500/30 hover:border-orange-400/50',
  pink: 'from-pink-600/20 to-pink-900/20 border-pink-500/30 hover:border-pink-400/50',
  indigo: 'from-indigo-600/20 to-indigo-900/20 border-indigo-500/30 hover:border-indigo-400/50',
  teal: 'from-teal-600/20 to-teal-900/20 border-teal-500/30 hover:border-teal-400/50',
};

const iconColorClasses: Record<ColorVariant, string> = {
  purple: 'bg-purple-600/20 text-purple-400',
  cyan: 'bg-cyan-600/20 text-cyan-400',
  blue: 'bg-blue-600/20 text-blue-400',
  green: 'bg-green-600/20 text-green-400',
  yellow: 'bg-yellow-600/20 text-yellow-400',
  orange: 'bg-orange-600/20 text-orange-400',
  pink: 'bg-pink-600/20 text-pink-400',
  indigo: 'bg-indigo-600/20 text-indigo-400',
  teal: 'bg-teal-600/20 text-teal-400',
};

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
  const isUpgrade = status === 'upgrade';

  const getStatusBadge = () => {
    if (isUpgrade) {
      return (
        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
          Upgrade
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
          Active
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
        Coming Soon
      </span>
    );
  };

  return (
    <div
      onClick={isActive ? onClick : undefined}
      className={`
        group relative bg-gradient-to-br ${colorClasses[color]}
        rounded-xl p-4 border transition-all duration-200
        ${isActive ? 'cursor-pointer hover:scale-105 hover:shadow-xl' : 'cursor-not-allowed opacity-60'}
        ${className}
      `}
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
      {/* Icon and Status Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${isActive ? iconColorClasses[color] : 'bg-gray-700/50'}
        `}>
          <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
        </div>
        {getStatusBadge()}
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-white mb-1.5">
        {title}
      </h3>
      <p className="text-gray-400 text-xs leading-relaxed">
        {description}
      </p>

      {/* Hover Overlay for Active Tiles */}
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
    </div>
  );
}

// Simple version for settings pages without gradient backgrounds
export function SimpleTileCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
  className = '',
}: Omit<TileCardProps, 'status'>) {
  const hoverColorClasses: Record<ColorVariant, string> = {
    purple: 'hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20',
    cyan: 'hover:bg-cyan-600 hover:border-cyan-500 hover:shadow-cyan-500/20',
    blue: 'hover:bg-blue-600 hover:border-blue-500 hover:shadow-blue-500/20',
    green: 'hover:bg-green-600 hover:border-green-500 hover:shadow-green-500/20',
    yellow: 'hover:bg-yellow-600 hover:border-yellow-500 hover:shadow-yellow-500/20',
    orange: 'hover:bg-orange-600 hover:border-orange-500 hover:shadow-orange-500/20',
    pink: 'hover:bg-pink-600 hover:border-pink-500 hover:shadow-pink-500/20',
    indigo: 'hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-indigo-500/20',
    teal: 'hover:bg-teal-600 hover:border-teal-500 hover:shadow-teal-500/20',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-gray-800 border border-gray-700 rounded-xl p-4 
        text-left transition-all duration-300 hover:scale-105 hover:shadow-xl 
        ${hoverColorClasses[color]} group cursor-pointer
        ${className}
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconColorClasses[color]} rounded-lg flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">
        {title}
      </h3>
      <p className="text-gray-400 text-xs leading-relaxed">
        {description}
      </p>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <span>Configure</span>
        </div>
      </div>
    </div>
  );
}
