import React from 'react';

interface LinkedInLogoProps {
  size?: number;
  className?: string;
}

export const LinkedInLogo: React.FC<LinkedInLogoProps> = ({ 
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
    {/* Official LinkedIn Logo */}
    <g fillRule="evenodd">
      {/* Background Square */}
      <rect 
        width="72" 
        height="72" 
        rx="4" 
        ry="4" 
        fill="#0A66C2"
      />
      
      {/* LinkedIn "in" text */}
      <g fill="white">
        {/* Letter "i" */}
        <path d="M13.139 27.848h9.623V58.81h-9.623V27.848zm4.813-15.391c3.077 0 5.577 2.5 5.577 5.577 0 3.08-2.5 5.581-5.577 5.581a5.58 5.58 0 1 1 0-11.158z"/>
        
        {/* Letter "n" */}
        <path d="M25.994 27.848h9.225v4.242h.13c1.285-2.434 4.424-5 9.105-5 9.744 0 11.544 6.413 11.544 14.75V58.81h-9.617V43.753c0-3.59-.066-8.209-5-8.209-5.007 0-5.77 3.911-5.77 7.941V58.81h-9.617V27.848z"/>
      </g>
    </g>
  </svg>
);

export default LinkedInLogo;