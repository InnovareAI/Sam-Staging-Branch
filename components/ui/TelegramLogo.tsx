import React from 'react';

interface TelegramLogoProps {
  size?: number;
  className?: string;
}

export const TelegramLogo: React.FC<TelegramLogoProps> = ({ 
  size = 24, 
  className = "" 
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 72 72" 
    className={className}
    fill="currentColor"
  >
    <g fillRule="evenodd">
      {/* Background Circle */}
      <circle 
        cx="36" 
        cy="36" 
        r="36" 
        fill="#0088cc"
      />
      
      {/* Telegram Paper Plane Icon */}
      <g fill="white">
        <path d="M25.34 36.34l-6.34-2.12c-.53-.18-.53-.95 0-1.13l29.66-11.88c.53-.21 1.06.32.85.85L37.64 51.72c-.18.53-.95.53-1.13 0l-2.83-8.49c-.21-.64-.85-1.06-1.49-.85l-6.85 2.96z"/>
        <path d="M31.02 38.83l1.49-6.38c.21-.85 1.28-1.06 1.7-.32l2.13 3.83c.32.53-.11 1.17-.74.96l-4.58-1.09z"/>
      </g>
    </g>
  </svg>
);

export default TelegramLogo;