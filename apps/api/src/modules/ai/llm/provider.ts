/**
 * Interfaz propia de LLM. Los adaptadores (Gemini, OpenAI, Anthropic, Mock) la implementan;
 * el agente no conoce ningún SDK.
 */
export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: LlmRole;
  content?: string;
  toolCalls?: LlmToolCall[];
  /** Para role=tool: a qué llamada responde y su resultado JSON. */
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (subset: object/properties/required)
}

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  model: string;
  finishReason?: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(request: LlmRequest): Promise<LlmResponse>;
  embed(texts: string[], model: string): Promise<number[][]>;
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}
