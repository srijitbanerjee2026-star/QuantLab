import React from 'react';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  size?: 'sm' | 'xs';
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'xs',
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex items-center bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-md ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`font-mono transition-all duration-150 rounded ${
              size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
            } ${
              isActive
                ? 'bg-slate-800 text-blue-400 font-bold border border-slate-700/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
