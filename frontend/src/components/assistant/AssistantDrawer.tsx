'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, X, Send, Trash2, Loader2, AlertTriangle, Lightbulb, RefreshCw, Wrench } from 'lucide-react';
import { Markdown } from './Markdown';
import { useKeyed } from '@/hooks/useKeyed';
import { getAssistantStatus, sendChat, chatErrorMessage, ChatTurn, ToolCall } from '@/lib/api/assistant';

interface Msg extends ChatTurn {
  tools?: ToolCall[];
  facts?: string[];
}

const MODULE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  explorer: 'Market Explorer',
  multi_asset: 'Cross-Asset Analysis',
  technicals: 'Technical Analysis',
  options_greeks: 'Options & Greeks',
  macro: 'Macro & Rates',
  seasonality: 'Seasonality',
  ml_predictor: 'ML Models',
  experiments: 'Experiments',
  risk_var: 'Risk Analysis',
  optimizer: 'Optimisation',
  backtest: 'Backtesting',
};

const starters = (symbol: string): string[] => [
  'What is a stock, and how is it different from an ETF?',
  `How much could I lose in a bad year holding ${symbol}?`,
  `Is ${symbol} riskier than the S&P 500?`,
  'What does volatility mean, in simple terms?',
  'What is a backtest, and why can the results mislead me?',
  'What is going on in the economy right now?',
  'How do I start investing with a small amount?',
];

export const AssistantDrawer: React.FC<{ open: boolean; onClose: () => void; activeModule: string; focusTicker: string }> = ({ open, onClose, activeModule, focusTicker }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNonce, setStatusNonce] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const status = useKeyed(`assistant-status|${open}|${statusNonce}`, () => (open ? getAssistantStatus() : Promise.resolve(null)));
  const configured = status.data?.configured ?? null;
  const isLocal = status.data?.provider === 'ollama';

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && configured) box.current?.focus();
  }, [open, configured]);

  const page = { module: MODULE_NAMES[activeModule] ?? activeModule, symbol: focusTicker };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const res = await sendChat(next.map(({ role, content }) => ({ role, content })), page);
      setMessages([...next, { role: 'assistant', content: res.reply, tools: res.tool_calls, facts: res.facts }]);
    } catch (e) {
      setError(chatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const describe = (t: ToolCall) => {
    const sym = (t.input.symbol as string) || (Array.isArray(t.input.symbols) ? (t.input.symbols as string[]).join(', ') : '');
    return `${t.label}${sym ? ` · ${sym}` : ''}`;
  };

  if (!open) return null;

  return (
    <aside role="dialog" aria-label="QuantLab Coach" className="fixed top-0 right-0 bottom-0 z-[60] w-full sm:w-[430px] flex flex-col bg-[#070707] border-l border-slate-700 shadow-[-12px_0_40px_rgba(0,0,0,0.6)] select-text">
      <header className="h-12 px-4 flex items-center justify-between border-b border-slate-700 bg-[#0d0d0d] shrink-0">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-blue-400">QuantLab Coach</span>
          {status.data?.model && <span className="text-[9px] text-slate-500 border border-slate-700 px-1.5 py-0.5">{isLocal ? 'local · ' : ''}{status.data.model}</span>}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null); }} className="p-1.5 text-slate-500 hover:text-slate-200" title="Clear conversation" aria-label="Clear conversation">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200" title="Close (Esc)" aria-label="Close assistant">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="px-4 py-1.5 text-[10px] text-amber-400/90 bg-amber-400/[0.06] border-b border-amber-400/20 shrink-0">
        Educational only. Not financial advice. Market data is delayed.
        {isLocal && configured && ' Running on your PC: answers can take a minute or two.'}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {status.loading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking assistant…</div>}

        {status.err && (
          <div className="p-3 border border-rose-500/40 text-xs text-rose-300">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1.5" />
            Could not reach the backend, so the assistant is unavailable.
          </div>
        )}

        {configured === false && (
          <div className="p-4 border border-slate-700 space-y-3">
            <div className="text-sm font-semibold text-slate-100">{isLocal ? 'The local model is not ready' : 'The assistant needs an API key'}</div>
            {status.data?.setup_hint && <p className="text-xs text-amber-400 leading-relaxed">{status.data.setup_hint}</p>}
            {isLocal ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">QuantLab Coach runs a free model on your own computer through Ollama, so nothing is sent to the cloud. To get it ready:</p>
                <ol className="text-xs text-slate-300 list-decimal pl-5 space-y-1.5 leading-relaxed">
                  <li>Install and open <span className="text-blue-300">Ollama</span> (ollama.com).</li>
                  <li>In a terminal run <code className="px-1 bg-white/10">ollama pull qwen2.5:3b</code> (about 2 GB, one time).</li>
                  <li>Close heavy programs to free memory, then press Check again.</li>
                </ol>
                <p className="text-[11px] text-slate-500">Want better answers later? Add an Anthropic key to <code className="px-1 bg-white/10">backend/.env</code> and the assistant switches to Claude automatically.</p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">QuantLab Coach is ready, but no Anthropic API key is configured on the backend yet. To switch it on:</p>
                <ol className="text-xs text-slate-300 list-decimal pl-5 space-y-1.5 leading-relaxed">
                  <li>Create a key at <span className="text-blue-300">console.anthropic.com</span>.</li>
                  <li>Open <code className="px-1 bg-white/10">backend/.env</code> and add <code className="px-1 bg-white/10">ANTHROPIC_API_KEY=your-key</code>.</li>
                  <li>Restart the backend, then press Check again.</li>
                </ol>
                <p className="text-[11px] text-slate-500">The key stays on your computer in the backend and is never sent to the browser.</p>
              </>
            )}
            <button onClick={() => setStatusNonce((n) => n + 1)} className="h-8 px-3 flex items-center gap-1.5 border border-slate-700 text-[11px] text-slate-300 hover:bg-white/5">
              <RefreshCw className="h-3 w-3" /> Check again
            </button>
          </div>
        )}

        {configured && messages.length === 0 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-100 font-semibold">Hi, I&apos;m your trading coach.</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Ask me anything about investing or what you see in QuantLab. I look up real data before quoting numbers, and I&apos;ll tell you plainly when something is risky or uncertain.
              </p>
            </div>
            <button
              onClick={() => send(`Explain what I'm looking at on the ${page.module} page in simple terms, and what the main takeaway is.`)}
              className="w-full h-9 flex items-center justify-center gap-2 bg-blue-400 text-black font-bold text-xs tracking-wider uppercase hover:bg-blue-300"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Explain this page ({page.module})
            </button>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Try asking</div>
              {starters(focusTicker).map((q) => (
                <button key={q} onClick={() => send(q)} className="w-full text-left px-3 py-2 text-xs text-slate-300 border border-slate-800 hover:border-slate-600 hover:bg-white/[0.03]">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'user' ? (
              <div className="max-w-[88%] px-3 py-2 bg-blue-400/15 border border-blue-400/30 text-[13px] text-slate-100 whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div className="space-y-2">
                <Markdown text={m.content} />
                {m.facts && m.facts.length > 0 && (
                  <div className="border border-slate-700 bg-[#0b0b0b]">
                    <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-blue-400 font-bold border-b border-slate-800">Data used (exact figures)</div>
                    <ul className="px-2.5 py-1.5 space-y-1 text-[11px] leading-snug text-slate-400 tabular-nums">
                      {m.facts.map((f, fi) => <li key={fi} className="pl-2 -indent-2 before:content-['·_'] before:text-slate-600">{f}</li>)}
                    </ul>
                  </div>
                )}
                {m.tools && m.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.tools.map((t, ti) => (
                      <span key={ti} title={JSON.stringify(t.input)} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] border ${t.ok ? 'border-slate-700 text-slate-500' : 'border-rose-500/40 text-rose-300'}`}>
                        <Wrench className="h-2.5 w-2.5" /> {describe(t)}{t.ok ? '' : ' (failed)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" /> {isLocal ? 'Fetching data and thinking on your PC… this can take a minute or two.' : 'Looking up data and thinking…'}
          </div>
        )}
        {error && (
          <div className="p-3 border border-rose-500/40 text-xs text-rose-300 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t border-slate-700 bg-[#0d0d0d] shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={box}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
              if (e.key === 'Escape') onClose();
            }}
            rows={2}
            maxLength={2000}
            disabled={!configured || loading}
            placeholder={configured ? 'Ask a question… (Enter to send)' : 'Assistant not configured'}
            className="flex-1 resize-none px-2.5 py-2 bg-[#050505] border border-slate-700 text-[13px] text-slate-100 outline-none focus:border-blue-400/70 disabled:opacity-50 placeholder:text-slate-600"
            aria-label="Message the assistant"
          />
          <button type="submit" disabled={!configured || loading || !input.trim()} className="h-[52px] w-11 flex items-center justify-center bg-blue-400 text-black disabled:opacity-30 hover:bg-blue-300" aria-label="Send message">
            <Send className="h-4 w-4" />
          </button>
        </div>
        {status.data && configured && (
          <div className="mt-1.5 text-[10px] text-slate-600 tabular-nums">
            {isLocal ? 'Free local model: no usage cost.' : `Today's usage: ${status.data.tokens_used_today.toLocaleString()} / ${status.data.daily_token_cap.toLocaleString()} tokens`}
          </div>
        )}
      </form>
    </aside>
  );
};
