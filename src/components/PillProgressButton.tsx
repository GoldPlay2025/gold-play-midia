import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export type PillProgressButtonProps = {
  onClick?: (e?: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  isLoading?: boolean;
  progress?: number;
  label: string;
  loadingLabel?: string;
  icon?: React.ReactNode;
  variant?: 'amber' | 'emerald' | 'rose' | 'slate' | 'gold';
  className?: string;
};

export function PillProgressButton({
  onClick,
  type = 'button',
  disabled,
  isLoading = false,
  progress,
  label,
  loadingLabel,
  icon,
  variant = 'amber',
  className = ''
}: PillProgressButtonProps) {
  const [internalProgress, setInternalProgress] = useState(15);

  useEffect(() => {
    let interval: any;
    if (isLoading && progress === undefined) {
      setInternalProgress(18);
      interval = setInterval(() => {
        setInternalProgress(prev => {
          if (prev >= 92) return prev;
          return prev + Math.floor(Math.random() * 8 + 4);
        });
      }, 160);
    } else if (!isLoading) {
      setInternalProgress(15);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, progress]);

  const activeProgress = progress !== undefined ? progress : internalProgress;
  const currentProgress = Math.min(100, Math.max(8, activeProgress));

  if (isLoading) {
    return (
      <div className={`relative overflow-hidden bg-black/90 border border-white/15 rounded-full h-11 w-full flex items-center p-1 shadow-inner select-none ${className}`}>
        {/* Track Progress Bar */}
        <div 
          className={`h-full rounded-full transition-all duration-300 flex items-center justify-end pr-0.5 shadow-lg relative ${
            variant === 'rose'
              ? 'bg-gradient-to-r from-rose-700 via-rose-500 to-rose-400 animate-stripes shadow-rose-500/40'
              : variant === 'emerald'
              ? 'bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400 animate-stripes shadow-emerald-500/40'
              : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 animate-stripes shadow-amber-500/50'
          }`}
          style={{ width: `${Math.max(currentProgress, 14)}%` }}
        >
          {/* Thumb indicator circle */}
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white via-amber-200 to-amber-400 border-2 border-white shadow-lg shadow-amber-500/80 shrink-0 flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 bg-amber-900 rounded-full" />
          </div>
        </div>

        {/* Text & Percentage Overlay */}
        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
          <span className="text-[11px] font-bold text-white font-mono tracking-wider flex items-center gap-2 drop-shadow-md truncate pr-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
            {loadingLabel || label}
          </span>
          <span className="text-xs font-black font-mono text-amber-300 drop-shadow-lg shrink-0">
            {currentProgress}%
          </span>
        </div>
      </div>
    );
  }

  // Normal Button state
  const baseStyles = "relative h-11 px-6 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg cursor-pointer";
  
  let colorStyles = "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20 hover:shadow-amber-500/35 border border-amber-400/30";
  if (variant === 'emerald') {
    colorStyles = "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/20 hover:shadow-emerald-500/35 border border-emerald-400/30";
  } else if (variant === 'rose') {
    colorStyles = "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-500/20 hover:shadow-rose-500/35 border border-rose-400/30";
  } else if (variant === 'slate') {
    colorStyles = "bg-white/5 hover:bg-white/10 text-white border border-white/10";
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${colorStyles} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
