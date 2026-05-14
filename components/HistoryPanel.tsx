'use client';

import { useChatStore, Conversation } from '@/store/chatStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
}

export function HistoryPanel({ onSelect, onNew }: Props) {
  const { conversations, activeId, deleteConversation } = useChatStore();

  const grouped = groupByDate(conversations);

  return (
    <aside className="hidden xl:flex flex-col w-64 shrink-0 bg-bg-surface border-l border-border-main font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border-main shrink-0">
        <span className="text-text-3 tracking-widest uppercase text-[10px]">History</span>
        <button
          onClick={onNew}
          title="New session"
          className="text-accent hover:opacity-70 transition-opacity text-[11px] tracking-widest px-2 py-1 border border-accent/30 hover:border-accent"
        >
          + NEW
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-text-3 text-[10px] tracking-wider text-center leading-relaxed">
            No sessions yet.
            <br />
            Start a conversation.
          </div>
        ) : (
          Object.entries(grouped).map(([label, convs]) => (
            <div key={label}>
              {/* Date group label */}
              <div className="px-3 py-1.5 text-[9px] tracking-widest text-text-3 uppercase bg-bg-base/60 border-b border-border-main sticky top-0">
                {label}
              </div>

              {convs.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <div
                    key={conv.id}
                    className={`group relative flex flex-col px-3 py-2.5 cursor-pointer border-b border-border-main/50 transition-colors
                      ${isActive
                        ? 'bg-accent/10 border-l-2 border-l-accent'
                        : 'hover:bg-bg-base border-l-2 border-l-transparent'
                      }`}
                    onClick={() => onSelect(conv)}
                  >
                    {/* Title */}
                    <span
                      className={`truncate text-[11px] leading-snug tracking-wide ${isActive ? 'text-accent font-bold' : 'text-text-1'
                        }`}
                    >
                      {conv.title}
                    </span>

                    {/* Meta row */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-text-3 text-[9px] tracking-wider">
                        {formatRelativeTime(conv.updatedAt)}
                      </span>
                      <span className="text-text-3 text-[9px]">
                        {conv.messages.filter((m) => m.role === 'user').length} msg
                      </span>
                    </div>

                    {/* Delete button — appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      title="Delete"
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-3 hover:text-red-400 px-1"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border-main text-[9px] text-text-3 tracking-widest text-center shrink-0">
        {conversations.length} SESSION{conversations.length !== 1 ? 'S' : ''} STORED LOCALLY
      </div>
    </aside>
  );
}

// ─── Group conversations by date label ────────────────────────────────────────

function groupByDate(convs: Conversation[]): Record<string, Conversation[]> {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(today.getTime() - 86_400_000));
  const lastWeek = startOfDay(new Date(today.getTime() - 7 * 86_400_000));

  const groups: Record<string, Conversation[]> = {};

  for (const conv of convs) {
    const d = new Date(conv.updatedAt);
    let label: string;

    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= lastWeek) label = 'Last 7 days';
    else label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }

  return groups;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
