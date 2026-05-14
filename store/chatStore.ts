import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolId?: string;
  isError?: boolean;
  collapsed?: boolean;
  pendingToolCalls?: any[];
  confirmResolved?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  apiMessages: any[];
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
  // actions
  newConversation: () => Conversation;
  setActive: (id: string | null) => void;
  updateMessages: (id: string, messages: StoredMessage[], apiMessages: any[]) => void;
  setTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  getActive: () => Conversation | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      newConversation: () => {
        const conv: Conversation = {
          id: uid(),
          title: 'New session',
          messages: [],
          apiMessages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: conv.id,
        }));
        return conv;
      },

      setActive: (id) => set({ activeId: id }),

      updateMessages: (id, messages, apiMessages) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id
              ? { ...c, messages, apiMessages, updatedAt: new Date().toISOString() }
              : c
          ),
        })),

      setTitle: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        })),

      deleteConversation: (id) =>
        set((s) => {
          const remaining = s.conversations.filter((c) => c.id !== id);
          const newActiveId =
            s.activeId === id ? (remaining[0]?.id ?? null) : s.activeId;
          return { conversations: remaining, activeId: newActiveId };
        }),

      getActive: () => {
        const { conversations, activeId } = get();
        return conversations.find((c) => c.id === activeId) ?? null;
      },
    }),
    { name: 'chat-history' }
  )
);
