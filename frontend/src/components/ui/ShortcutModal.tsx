'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';

export interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['1', '2', '3', '4'], label: 'Focus / Expand Panels 1 through 4' },
  { keys: ['F'], label: 'Toggle Fullscreen Mode on focused panel' },
  { keys: ['L'], label: 'Toggle Linear / Log Scale on Returns chart' },
  { keys: ['C'], label: 'Toggle Hierarchical Clustering on Correlation Matrix' },
  { keys: ['P'], label: 'Pin / Unpin current hovered ticker' },
  { keys: ['Esc'], label: 'Clear Ticker Pin / Close Modal / Exit Fullscreen' },
  { keys: ['['], label: 'Collapse or Expand Left Navigation Sidebar' },
  { keys: ['⌘', 'K'], label: 'Open Global Command Palette & Ticker Search' },
  { keys: ['?'], label: 'Open this Keyboard Shortcuts Cheat Sheet' },
];

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="w-full max-w-lg rounded-xl bg-[#0b101f] border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Keyboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    QuantLab 2030 Terminal Hotkeys
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Fast keyboard-first navigation for quantitative desks
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcut List */}
            <div className="p-5 space-y-2.5 max-h-[70vh] overflow-y-auto font-mono">
              {SHORTCUTS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-xs text-slate-300 font-sans">{item.label}</span>
                  <div className="flex items-center space-x-1 shrink-0">
                    {item.keys.map((k, kIdx) => (
                      <Kbd key={kIdx}>{k}</Kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-white/[0.08] bg-white/[0.01] flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Press <Kbd>Esc</Kbd> or <Kbd>?</Kbd> to dismiss</span>
              <span>QuantLab Pro Terminal</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
