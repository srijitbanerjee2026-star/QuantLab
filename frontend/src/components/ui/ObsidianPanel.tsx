'use client';

import React, { useState } from 'react';
import { Maximize2, Minimize2, Download, MoreHorizontal, Pin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ObsidianPanelProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  headerControls?: React.ReactNode;
  accentColor?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onExportCSV?: () => void;
  className?: string;
}

export const ObsidianPanel: React.FC<ObsidianPanelProps> = ({
  id,
  title,
  subtitle,
  badge,
  children,
  headerControls,
  accentColor = '#60a5fa',
  isFullscreen = false,
  onToggleFullscreen,
  onExportCSV,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <motion.section
      layout
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowSettings(false);
      }}
      className={`obsidian-panel rounded-lg flex flex-col relative transition-all duration-200 select-none ${
        isFullscreen
          ? 'fixed inset-4 z-50 bg-[#070b14]/95 shadow-[0_0_80px_rgba(0,0,0,0.9)] border-slate-700'
          : 'h-full'
      } ${className}`}
      style={{
        boxShadow: isHovered
          ? `0 12px 36px -8px ${accentColor}18, inset 0 1px 0 rgba(255,255,255,0.08)`
          : undefined,
      }}
    >
      {/* 1px Gradient Border Overlay (white/10 to white/0) */}
      <div className="absolute inset-0 rounded-lg pointer-events-none border border-transparent bg-gradient-to-b from-white/10 to-transparent [mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] [-webkit-mask-composite:xor] [mask-composite:exclude]" />

      {/* Panel Header */}
      <div className="h-9 min-h-[36px] px-3.5 border-b border-white/[0.06] flex items-center justify-between text-xs font-mono relative z-10 bg-white/[0.015]">
        {/* Left: Title & Subtitle */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 truncate">
            {title}
          </span>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-white/[0.06] text-slate-400 border border-white/[0.08]">
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-[10px] text-slate-500 font-sans hidden xl:inline truncate">
              · {subtitle}
            </span>
          )}
        </div>

        {/* Right: Custom Controls + Hover Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {headerControls}

          {/* Action Superpowers (fade in on hover) */}
          <div
            className={`flex items-center space-x-1 pl-1.5 border-l border-white/[0.08] transition-opacity duration-150 ${
              isHovered || isFullscreen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Pin action */}
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? 'Unpin Panel' : 'Pin Panel'}
              className={`p-1 rounded transition hover:bg-white/10 ${
                isPinned ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>

            {/* Export action */}
            {onExportCSV && (
              <button
                type="button"
                onClick={onExportCSV}
                title="Export Dataset (CSV)"
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10 transition"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Fullscreen Expand action */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand Fullscreen (F)'}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10 transition"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5 text-blue-400" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* Settings action */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                title="Panel Settings"
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10 transition"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-7 w-40 rounded-md bg-[#0d1322] border border-slate-700/80 shadow-2xl p-1 z-30 text-[11px]"
                  >
                    <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                      Panel Options
                    </div>
                    {onExportCSV && (
                      <button
                        type="button"
                        onClick={() => {
                          onExportCSV();
                          setShowSettings(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-slate-300 hover:bg-white/[0.08] transition"
                      >
                        Export CSV
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                        setShowSettings(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-slate-300 hover:bg-white/[0.08] transition"
                    >
                      Print View
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-3.5 flex flex-col min-h-0 relative z-0">{children}</div>
    </motion.section>
  );
};
