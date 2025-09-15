import React from 'react';

interface CalendlyLogoProps {
  size?: number;
  className?: string;
}

export const CalendlyLogo: React.FC<CalendlyLogoProps> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path fill="#006BFF" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 16.568c-.878.878-2.127 1.421-3.486 1.421-1.36 0-2.608-.543-3.486-1.421-.878-.878-1.421-2.126-1.421-3.486 0-1.359.543-2.608 1.421-3.486.878-.878 2.126-1.421 3.486-1.421 1.359 0 2.608.543 3.486 1.421.878.878 1.421 2.127 1.421 3.486 0 1.36-.543 2.608-1.421 3.486z"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  );
};