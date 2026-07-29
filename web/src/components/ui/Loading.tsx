import React from 'react';

export interface LoadingProps {
  variant?: 'fullscreen' | 'container' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  variant = 'container',
  size = 'md',
  text = 'Đang tải dữ liệu...',
  className = '',
}) => {
  // Size classes
  const spinnerSizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-[2.5px]',
    lg: 'w-11 h-11 border-[3px]',
  };

  const glowSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-2 text-current ${className}`}>
        <div className="w-4 h-4 rounded-full border-2 border-[#86cd3d]/30 border-t-[#86cd3d] animate-spin shrink-0" />
        {text && <span className="text-xs font-medium">{text}</span>}
      </span>
    );
  }

  const containerClasses =
    variant === 'fullscreen'
      ? 'min-h-[75vh] w-full flex flex-col items-center justify-center bg-transparent'
      : 'min-h-[220px] w-full flex flex-col items-center justify-center py-10 px-4';

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="relative flex items-center justify-center mb-3">
        {/* Soft green glow */}
        <div className={`absolute ${glowSizes[size]} rounded-full bg-[#86cd3d]/25 blur-md animate-pulse`} />
        {/* Single green spinning arc */}
        <div
          className={`${spinnerSizes[size]} rounded-full border-[#86cd3d]/25 border-t-[#86cd3d] animate-spin shrink-0`}
        />
      </div>
      {text && (
        <span className="text-[13px] font-medium text-gray-400 tracking-wide select-none">
          {text}
        </span>
      )}
    </div>
  );
};

export default Loading;
