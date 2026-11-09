import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 text-current ${className}`}>
      <svg 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-8 w-8 shrink-0" 
        aria-label="Clippboard logo"
      >
        {/* The black rounded square - adapts to light/dark mode via currentColor */}
        <rect width="32" height="32" rx="8" fill="currentColor" />
        
        {/* The inner cutout shape */}
        <path 
          d="M10 11C10 10.4477 10.4477 10 11 10H21C21.5523 10 22 10.4477 22 11V12.5C22 13.0523 21.5523 13.5 21 13.5H18C17.4477 13.5 17 13.9477 17 14.5V17.5C17 18.0523 17.4477 18.5 18 18.5H21C21.5523 18.5 22 18.9477 22 19.5V21C22 21.5523 21.5523 22 21 22H11C10.4477 22 10 21.5523 10 21V11Z" 
          fill="#F9F7F4" 
        />
      </svg>
      
      {!iconOnly && (
        <span className="text-2xl font-bold -tracking-1">
          Clippboard
        </span>
      )}
    </div>
  );
}
