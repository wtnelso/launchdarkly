import { useSyncExternalStore } from 'react';
import { sendChat, sendChatFeedback, type ServedAiConfig } from '../../api';
import { contextFor } from '../part2/personas';
import { getPersona } from '../part2/personaStore';

export interface AssistantTurn {
  served: ServedAiConfig;
  style?: 'concise' | 'friendly';
  durationMs: number;
  tokens: number;
  resumptionToken?: string;
  feedback?: 'positive' | 'negative';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  turn?: AssistantTurn;
}

export interface ChatState {
  messages: ChatMessage[];
  pending: boolean;
  disabled: boolean;
  error: string | null;
  turns: number;
}

let state: ChatState = { messages: [], pending: false, disabled: false, error: null, turns: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<ChatState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useChat(): ChatState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function resetChat(): void {
  set({ messages: [], pending: false, disabled: false, error: null });
}

export async function sendMessage(text: string): Promise<void> {
  const content = text.trim();
  if (!content || state.pending) return;
  const context = contextFor(getPersona());
  set({ messages: [...state.messages, { id: newId(), role: 'user', content, at: new Date().toISOString() }], pending: true, error: null });
  try {
    const res = await sendChat(context, content);
    if (!res.enabled || !res.reply) {
      set({ pending: false, disabled: true, turns: state.turns + 1 });
      return;
    }
    set({
      pending: false,
      disabled: false,
      turns: state.turns + 1,
      messages: [
        ...state.messages,
        {
          id: newId(),
          role: 'assistant',
          content: res.reply,
          at: res.generatedAt,
          turn: {
            served: res.served,
            style: res.style,
            durationMs: res.metrics?.durationMs ?? 0,
            tokens: res.metrics?.tokens.total ?? 0,
            resumptionToken: res.resumptionToken,
          },
        },
      ],
    });
  } catch (err) {
    set({ pending: false, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function rateMessage(id: string, kind: 'positive' | 'negative'): Promise<void> {
  const msg = state.messages.find((m) => m.id === id);
  if (!msg?.turn?.resumptionToken || msg.turn.feedback) return;
  set({ messages: state.messages.map((m) => (m.id === id && m.turn ? { ...m, turn: { ...m.turn, feedback: kind } } : m)) });
  try {
    await sendChatFeedback(contextFor(getPersona()), msg.turn.resumptionToken, kind);
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) });
  }
}
