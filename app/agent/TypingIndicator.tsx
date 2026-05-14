export function TypingIndicator({ phase }: { phase: 'thinking' | 'tool' | 'responding' }) {
  const labels = {
    thinking: 'Reasoning...',
    tool: 'Executing tool...',
    responding: 'Writing response...',
  };

  const colors = {
    thinking: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5',
    tool: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5',
    responding: 'text-accent border-accent/20 bg-accent/5',
  };

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span className={phase === 'thinking' ? 'text-yellow-400' : phase === 'tool' ? 'text-emerald-400' : 'text-accent'}>
          {phase === 'thinking' ? 'THINKING' : phase === 'tool' ? 'TOOL' : 'AGENT'}
        </span>
      </div>

      <div className={`px-4 py-2 border font-mono text-sm animate-pulse ${colors[phase]}`}>
        <span className="mr-2">{'>'}</span>
        <span>{labels[phase]}</span>
        <span className="ml-1 animate-ping">_</span>
      </div>
    </div>
  );
}
