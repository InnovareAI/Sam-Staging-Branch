import React from 'react';

interface TwitterLogoProps {
  size?: number;
  className?: string;
}

export const TwitterLogo: React.FC<TwitterLogoProps> = ({ 
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
        fill="#1DA1F2"
      />
      
      {/* Twitter Bird Icon */}
      <g fill="white">
        <path d="M53.5 26.3c-1.2.5-2.5.9-3.9 1 1.4-.8 2.5-2.1 3-3.7-1.3.8-2.7 1.3-4.2 1.6-1.2-1.3-2.9-2.1-4.8-2.1-3.6 0-6.6 2.9-6.6 6.6 0 .5.1 1 .2 1.5-5.5-.3-10.4-2.9-13.7-6.9-.6 1-.9 2.1-.9 3.3 0 2.3 1.2 4.3 2.9 5.5-1.1 0-2.1-.3-3-.8v.1c0 3.2 2.3 5.8 5.3 6.4-.6.1-1.1.2-1.7.2-.4 0-.8 0-1.2-.1.8 2.6 3.2 4.5 6 4.5-2.2 1.7-5 2.7-8 2.7-.5 0-1 0-1.5-.1 2.9 1.9 6.4 3 10.1 3 12.1 0 18.7-10 18.7-18.7v-.8c1.3-.9 2.4-2.1 3.3-3.4z"/>
      </g>
    </g>
  </svg>
);

export default TwitterLogo;