import type { Message, Session } from './types';

export interface ApiOptions {
  apiUrl: string;
  widgetKey: string;
  /** Origen de la página anfitriona (para la allowlist de dominios). */
  host: string;
}

export type StreamEvent =
  | { type: 'message'; payload: Message }
  | { type: 'typing'; payload: { who: string; typing: boolean } }
  | { type: 'status'; payload: { status: string; assigneeId?: string | null } }
  | { type: 'open' | 'error' | 'reconnecting'; payload?: unknown };

const ANON_KEY = 'sc:anonId';

export class WidgetApi {
  constructor(private readonly opts: ApiOptions) {}

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { 'X-Widget-Key': this.opts.widgetKey, 'X-Widget-Host': this.opts.host };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async startSession(metadata: Record<string, unknown>): Promise<Session> {
    const anonId = safeStorage.get(ANON_KEY) ?? undefined;
    const res = await fetch(`${this.opts.apiUrl}/widget/session`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ anonId, metadata }) });
    if (!res.ok) throw new Error(`No se pudo iniciar el chat (${res.status})`);
    const session = (await res.json()) as Session;
    safeStorage.set(ANON_KEY, session.anonId);
    return session;
  }

  async send(conversationId: string, text: string, quickReply?: string): Promise<Message> {
    const res = await fetch(`${this.opts.apiUrl}/widget/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ text, quickReply }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'No se pudo enviar el mensaje');
    }
    return res.json();
  }

  async handoff(conversationId: string) {
    await fetch(`${this.opts.apiUrl}/widget/conversations/${conversationId}/handoff`, { method: 'POST', headers: this.headers() });
  }

  typing(conversationId: string, typing: boolean) {
    void fetch(`${this.opts.apiUrl}/widget/conversations/${conversationId}/typing`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ typing }), keepalive: true }).catch(() => undefined);
  }

  /**
   * SSE con reconexión exponencial y reenvío de eventos perdidos (lastEventId).
   * EventSource no permite cabeceras, así que la clave y el lastEventId van en la query.
   */
  stream(conversationId: string, lastSeq: number, onEvent: (e: StreamEvent) => void): () => void {
    let source: EventSource | null = null;
    let closed = false;
    let attempt = 0;
    let lastId = lastSeq;

    const connect = () => {
      if (closed) return;
      const url = `${this.opts.apiUrl}/widget/conversations/${conversationId}/events?key=${encodeURIComponent(this.opts.widgetKey)}&host=${encodeURIComponent(this.opts.host)}&lastEventId=${lastId}`;
      source = new EventSource(url);
      source.onopen = () => { attempt = 0; onEvent({ type: 'open' }); };
      source.addEventListener('message', (ev) => {
        const message = JSON.parse((ev as MessageEvent).data) as Message;
        if ((ev as MessageEvent).lastEventId) lastId = Number((ev as MessageEvent).lastEventId);
        onEvent({ type: 'message', payload: message });
      });
      source.addEventListener('typing', (ev) => onEvent({ type: 'typing', payload: JSON.parse((ev as MessageEvent).data) }));
      source.addEventListener('status', (ev) => onEvent({ type: 'status', payload: JSON.parse((ev as MessageEvent).data) }));
      source.onerror = () => {
        source?.close();
        if (closed) return;
        attempt += 1;
        onEvent({ type: 'reconnecting', payload: { attempt } });
        setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
      };
    };
    connect();
    return () => { closed = true; source?.close(); };
  }
}

export const safeStorage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* modo privado / iframe sin storage */ }
  },
};
