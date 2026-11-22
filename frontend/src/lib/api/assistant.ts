// Typed client for the beginner assistant. The API key lives only on the backend.
import { apiClient } from '@/lib/api';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  name: string;
  label: string;
  ok: boolean;
  input: Record<string, unknown>;
}

export interface AssistantReply {
  reply: string;
  tool_calls: ToolCall[];
  /** Exact, code-labelled figures behind the answer (local model path). */
  facts?: string[];
  tokens_used: number;
  stop_reason: string;
}

export interface AssistantStatus {
  provider: 'anthropic' | 'ollama';
  ready: boolean;
  local?: boolean;
  configured: boolean;
  model: string | null;
  tokens_used_today: number;
  daily_token_cap: number;
  setup_hint: string | null;
}

export interface PageContext {
  module?: string;
  symbol?: string;
}

export async function getAssistantStatus(): Promise<AssistantStatus> {
  return (await apiClient.get<AssistantStatus>('/assistant/status', { timeout: 15000 })).data;
}

export async function sendChat(messages: ChatTurn[], page?: PageContext): Promise<AssistantReply> {
  return (await apiClient.post<AssistantReply>('/assistant/chat', { messages, page }, { timeout: 240000 })).data;
}

export function chatErrorMessage(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { detail?: unknown } }; message?: string };
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return 'That message could not be sent. Try a shorter message.';
  return err.message?.includes('timeout') ? 'The assistant took too long to answer. Please try again.' : 'Could not reach the backend. Is it running on port 8000?';
}
