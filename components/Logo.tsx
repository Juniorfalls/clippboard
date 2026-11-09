import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className = "", iconOnly = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-8 w-8 shrink-0" 
        aria-label="Clippboard logo"
      >
        <mask id="logo-cutout-mask">
          {/* White background means "keep" */}
          <rect width="32" height="32" fill="white" />
          
          {/* Black path means "cut out" - This is the exact shape of your 'C' */}
          <path 
            d="M 10 10 L 19 10 L 22 13 L 22 14.5 C 22 14.776 21.776 15 21.5 15 L 17.5 15 C 17.224 15 17 15.224 17 15.5 L 17 17.5 C 17 17.776 17.224 18 17.5 18 L 21.5 18 C 21.776 18 22 18.224 22 18.5 L 22 21.5 C 22 21.776 21.776 22 21.5 22 L 10.5 22 C 10.224 22 10 21.776 10 21.5 Z" 
            fill="black" 
          />
        </mask>
        
        {/* The outer rounded square inherits the text color (black in header, white in footer) */}
        <rect width="32" height="32" rx="8" fill="currentColor" mask="url(#logo-cutout-mask)" />
      </svg>
      
      {!iconOnly && (
        <span className="text-2xl font-bold -tracking-1">
          Clippboard
        </span>
      )}
    </div>
  );
}
