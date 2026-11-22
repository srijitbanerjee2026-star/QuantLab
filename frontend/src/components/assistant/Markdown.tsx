import React from 'react';

/** Minimal, safe markdown: paragraphs, bullet/numbered lists, headings, **bold**, `code`. Renders React nodes only (no HTML injection). */
const inline = (text: string, keyBase: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`|(?<!\w)_[^_\n]+_(?!\w))/g).map((part, i) => {
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={`${keyBase}-${i}`} className="text-slate-400 not-italic border-l-2 border-slate-700 pl-2 block mt-1 text-[12px]">{part.slice(1, -1)}</em>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={`${keyBase}-${i}`} className="px-1 bg-white/10 text-blue-300 text-[0.92em]">{part.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>;
  });

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-slate-300">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.length === 0) return null;
        const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullets || numbered) {
          const Tag = numbered ? 'ol' : 'ul';
          return (
            <Tag key={bi} className={`pl-5 space-y-1 ${numbered ? 'list-decimal' : 'list-disc'} marker:text-slate-500`}>
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), `${bi}-${li}`)}</li>)}
            </Tag>
          );
        }
        const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0]);
        if (heading) return <p key={bi} className="font-semibold text-blue-400 uppercase tracking-wider text-[11px]">{lines[0].replace(/^#{1,4}\s+/, '')}</p>;
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
