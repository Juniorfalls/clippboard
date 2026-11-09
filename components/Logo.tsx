import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  variant?: 'dark' | 'light'; // 'dark' means dark text for light bg, 'light' means light text for dark bg
}

export function Logo({ className = "", variant = 'dark' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="Clippboard logo"
        width={40}
        height={40}
        className={`h-8 w-auto shrink-0 ${
          variant === 'dark'
            ? 'mix-blend-multiply' // Makes white background invisible on light backgrounds
            : 'mix-blend-screen invert brightness-200' // Makes the black box white on dark backgrounds
        }`}
      />
      <span className={`text-2xl font-bold -tracking-1 ${variant === 'dark' ? 'text-soft-black' : 'text-warm-white'}`}>
        Clippboard
      </span>
    </div>
  );
}
