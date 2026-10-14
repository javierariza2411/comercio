import { LlmMessage, LlmProvider, LlmProviderError, LlmRequest, LlmResponse } from './provider';

/**
 * Adaptador para la API REST de Gemini (`models/{model}:generateContent`).
 * Contrato verificado contra https://ai.google.dev/api/generate-content: `contents`, `systemInstruction`,
 * `tools[].functionDeclarations`, partes `functionCall` / `functionResponse` y `usageMetadata`.
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.messages.map((m) => this.toContent(m)),
      tools: request.tools?.length ? [{ functionDeclarations: request.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }] : undefined,
      generationConfig: { temperature: request.temperature ?? 0.3, maxOutputTokens: request.maxOutputTokens ?? 700 },
    };
    const data = await this.post(`/models/${request.model}:generateContent`, body);
    const candidate = data.candidates?.[0];
    const parts: Array<Record<string, unknown>> = candidate?.content?.parts ?? [];
    const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p, index) => {
        const call = p.functionCall as { name: string; args?: Record<string, unknown> };
        return { id: `${call.name}#${index}`, name: call.name, args: call.args ?? {} };
      });
    return {
      text,
      toolCalls,
      model: data.modelVersion ?? request.model,
      finishReason: candidate?.finishReason,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  async embed(texts: string[], model: string): Promise<number[][]> {
    const data = await this.post(`/models/${model}:batchEmbedContents`, {
      requests: texts.map((text) => ({ model: `models/${model}`, content: { parts: [{ text }] } })),
    });
    return (data.embeddings ?? []).map((e: { values: number[] }) => e.values);
  }

  private toContent(message: LlmMessage) {
    if (message.role === 'tool') {
      return { role: 'user', parts: [{ functionResponse: { name: message.toolName, response: { result: message.toolResult } } }] };
    }
    if (message.role === 'assistant') {
      const parts: unknown[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) parts.push({ functionCall: { name: call.name, args: call.args } });
      return { role: 'model', parts };
    }
    return { role: 'user', parts: [{ text: message.content ?? '' }] };
  }

  private async post(path: string, body: unknown) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new LlmProviderError(`Gemini ${response.status}: ${detail.slice(0, 300)}`, response.status, response.status === 429 || response.status >= 500);
    }
    return response.json();
  }
}
