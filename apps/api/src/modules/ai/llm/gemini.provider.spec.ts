import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider', () => {
  it('construye la petición generateContent con systemInstruction, tools y functionResponse, y parsea functionCall', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ functionCall: { name: 'buscar_productos', args: { consulta: 'reloj' } } }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 15 },
          modelVersion: 'test-model-001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const provider = new GeminiProvider('key', 'https://example.test/v1beta', fetchMock);
    const res = await provider.chat({
      model: 'test-model',
      system: 'Eres un asistente.',
      messages: [
        { role: 'user', content: 'hola' },
        { role: 'assistant', toolCalls: [{ id: 'x#0', name: 'ver_precio_y_stock', args: { consulta: 'a' } }] },
        { role: 'tool', toolCallId: 'x#0', toolName: 'ver_precio_y_stock', toolResult: { productos: [] } },
      ],
      tools: [{ name: 'buscar_productos', description: 'd', parameters: { type: 'object', properties: {} } }],
    });

    expect(calls[0].url).toBe('https://example.test/v1beta/models/test-model:generateContent');
    const body = calls[0].body as { systemInstruction: { parts: Array<{ text: string }> }; contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>; tools: Array<{ functionDeclarations: Array<{ name: string }> }> };
    expect(body.systemInstruction.parts[0].text).toBe('Eres un asistente.');
    expect(body.tools[0].functionDeclarations[0].name).toBe('buscar_productos');
    expect(body.contents[1].role).toBe('model');
    expect(body.contents[1].parts[0]).toHaveProperty('functionCall');
    expect(body.contents[2].parts[0]).toHaveProperty('functionResponse');
    expect(res.toolCalls).toEqual([{ id: 'buscar_productos#0', name: 'buscar_productos', args: { consulta: 'reloj' } }]);
    expect(res.usage).toEqual({ inputTokens: 120, outputTokens: 15 });
    expect(res.model).toBe('test-model-001');
  });

  it('propaga errores HTTP como LlmProviderError con bandera retryable en 429/5xx', async () => {
    const fetchMock = (async () => new Response('quota', { status: 429 })) as unknown as typeof fetch;
    const provider = new GeminiProvider('key', 'https://example.test', fetchMock);
    await expect(provider.chat({ model: 'm', system: '', messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({ status: 429, retryable: true });
  });
});
