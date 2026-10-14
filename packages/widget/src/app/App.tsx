import { useEffect, useRef, useState } from 'preact/hooks';
import { WidgetApi, type StreamEvent } from './api';
import type { Message, ProductCard, Session } from './types';

interface Params {
  key: string;
  api: string;
  host: string;
  page: string;
  color: string;
}

function readParams(): Params {
  const p = new URLSearchParams(location.hash.slice(1));
  return { key: p.get('key') ?? '', api: p.get('api') ?? location.origin, host: p.get('host') ?? '', page: p.get('page') ?? '', color: p.get('color') ?? '#111827' };
}

/** Origen real de la página anfitriona: no confiamos en el parámetro `host`, que podría manipularse. */
function hostOrigin(fallback: string) {
  const ancestors = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors && ancestors.length) return ancestors[0];
  if (document.referrer) {
    try { return new URL(document.referrer).origin; } catch { /* ignore */ }
  }
  return fallback;
}

const post = (msg: unknown) => window.parent?.postMessage(msg, '*');

export function App() {
  const [params] = useState(readParams);
  const api = useRef<WidgetApi>();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('BOT');
  const [typing, setTyping] = useState<string | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'online' | 'reconnecting'>('connecting');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = useRef(false);
  const lastSeq = useRef(0);
  const typingTimer = useRef<number>();

  // Arranque: sesión + stream
  useEffect(() => {
    const host = hostOrigin(params.host);
    api.current = new WidgetApi({ apiUrl: params.api, widgetKey: params.key, host });
    let stop: (() => void) | undefined;
    api.current
      .startSession({ page: params.page, host })
      .then((s) => {
        setSession(s);
        setMessages(s.messages);
        setStatus(s.conversation.status);
        lastSeq.current = s.messages.reduce((m, x) => Math.max(m, x.seq), 0);
        stop = api.current!.stream(s.conversation.id, lastSeq.current, onEvent);
      })
      .catch((e: Error) => setError(e.message));
    const onParent = (e: MessageEvent) => {
      if (e.data?.type === 'sc:open') { isOpen.current = true; setTimeout(() => inputRef.current?.focus(), 50); }
    };
    window.addEventListener('message', onParent);
    return () => { stop?.(); window.removeEventListener('message', onParent); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onEvent(e: StreamEvent) {
    if (e.type === 'open') setConnection('online');
    if (e.type === 'reconnecting') setConnection('reconnecting');
    if (e.type === 'typing') setTyping(e.payload.typing && e.payload.who !== 'visitor' ? e.payload.who : null);
    if (e.type === 'status') setStatus(e.payload.status);
    if (e.type === 'message') {
      const m = e.payload;
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur.filter((x) => !(x.pending && x.role === 'VISITOR' && x.content.text === m.content.text)), m].sort((a, b) => a.seq - b.seq)));
      lastSeq.current = Math.max(lastSeq.current, m.seq);
      if (m.role !== 'VISITOR' && !isOpen.current) post({ type: 'sc:unread' });
    }
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  async function send(text: string, quickReply?: string) {
    const value = text.trim();
    if (!value || !session || sending) return;
    setSending(true);
    setError('');
    setDraft('');
    const optimistic: Message = { id: `tmp-${Date.now()}`, seq: lastSeq.current + 0.5, role: 'VISITOR', type: 'TEXT', content: { text: value }, createdAt: new Date().toISOString(), pending: true };
    setMessages((cur) => [...cur, optimistic]);
    try {
      await api.current!.send(session.conversation.id, value, quickReply);
    } catch (e) {
      setMessages((cur) => cur.filter((m) => m.id !== optimistic.id));
      setError((e as Error).message);
      setDraft(value);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onInput(value: string) {
    setDraft(value);
    if (!session) return;
    window.clearTimeout(typingTimer.current);
    api.current!.typing(session.conversation.id, true);
    typingTimer.current = window.setTimeout(() => api.current!.typing(session.conversation.id, false), 2000);
  }

  const cfg = session?.config;
  const brand = cfg?.branding.primaryColor ?? params.color;
  const lastBot = [...messages].reverse().find((m) => m.role !== 'VISITOR');
  const replies = lastBot?.type === 'QUICK_REPLIES' && lastBot.content.replies?.length ? lastBot.content.replies : cfg?.quickReplies ?? [];
  const whatsapp = cfg?.whatsappNumber?.replace(/\D/g, '');

  return (
    <div class="sc" style={{ '--brand': brand } as Record<string, string>}>
      <header class="sc-header">
        {cfg?.logoUrl ? <img src={cfg.logoUrl} alt="" class="sc-logo" /> : <span class="sc-logo sc-logo-fallback" aria-hidden="true">{cfg?.tenantName?.[0] ?? '…'}</span>}
        <div class="sc-title">
          <strong>{cfg?.assistantName ?? 'Asistente'}</strong>
          <span class="sc-sub" role="status">
            {connection === 'reconnecting' ? 'Reconectando…' : status === 'WITH_AGENT' ? 'Atendido por una persona' : status === 'WAITING_AGENT' ? 'Esperando a una persona' : cfg?.tenantName ?? ''}
          </span>
        </div>
        <button class="sc-icon" type="button" aria-label="Cerrar chat" onClick={() => { isOpen.current = false; post({ type: 'sc:close' }); }}>✕</button>
      </header>

      <div class="sc-list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
        {error && !session && <p class="sc-error">{error}</p>}
        {messages.map((m) => <Bubble key={m.id} m={m} onAction={(label) => send(label)} />)}
        {typing && <div class="sc-row sc-left"><div class="sc-bubble-msg sc-typing" aria-label="Escribiendo"><span /><span /><span /></div></div>}
      </div>

      {replies.length > 0 && status === 'BOT' && (
        <div class="sc-replies" role="group" aria-label="Respuestas rápidas">
          {replies.map((r) => <button key={r} type="button" class="sc-chip" onClick={() => send(r, r)}>{r}</button>)}
        </div>
      )}

      <form class="sc-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <input ref={inputRef} class="sc-input" value={draft} onInput={(e) => onInput((e.target as HTMLInputElement).value)} placeholder="Escribe tu mensaje…" aria-label="Escribe tu mensaje" maxLength={2000} disabled={!session} />
        <button class="sc-send" type="submit" aria-label="Enviar" disabled={!draft.trim() || sending || !session}>➤</button>
      </form>
      {error && session && <p class="sc-error sc-error-inline" role="alert">{error}</p>}
      <footer class="sc-footer">
        {status === 'BOT' && session && <button type="button" class="sc-link" onClick={() => api.current!.handoff(session.conversation.id)}>Hablar con una persona</button>}
        {whatsapp && <a class="sc-link" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Seguir por WhatsApp</a>}
      </footer>
    </div>
  );
}

function Bubble({ m, onAction }: { m: Message; onAction: (label: string) => void }) {
  const mine = m.role === 'VISITOR';
  if (m.role === 'SYSTEM') return <p class="sc-system">{m.content.text}</p>;
  if (m.type === 'PRODUCT_CARD' || m.type === 'CAROUSEL') {
    const items = m.content.items ?? [];
    return (
      <div class={`sc-row sc-left`}>
        <div class={`sc-cards ${items.length > 1 ? 'sc-carousel' : ''}`} role="list" aria-label="Productos">
          {items.map((p) => <Card key={p.productId} p={p} onAction={onAction} />)}
        </div>
      </div>
    );
  }
  return (
    <div class={`sc-row ${mine ? 'sc-right' : 'sc-left'}`}>
      <div class={`sc-bubble-msg ${mine ? 'sc-mine' : ''} ${m.pending ? 'sc-pending' : ''}`}>
        {m.type === 'IMAGE' && m.content.url && <img class="sc-img" src={m.content.url} alt={m.content.caption ?? 'Imagen'} loading="lazy" />}
        {m.type === 'FILE' && m.content.url && <a class="sc-file" href={m.content.url} target="_blank" rel="noreferrer">📄 {m.content.caption ?? 'Abrir archivo'}</a>}
        {m.content.text && <p>{m.content.text}</p>}
        {m.role === 'AGENT' && <span class="sc-meta">Persona del equipo</span>}
      </div>
    </div>
  );
}

function Card({ p, onAction }: { p: ProductCard; onAction: (label: string) => void }) {
  return (
    <article class="sc-card" role="listitem">
      {p.imageUrl ? <img src={p.imageUrl} alt={p.title} loading="lazy" /> : <div class="sc-card-ph" aria-hidden="true" />}
      <div class="sc-card-body">
        <h3>{p.title}</h3>
        {p.subtitle && <p class="sc-card-sub">{p.subtitle}</p>}
        <p class="sc-price">{p.price} {p.compareAtPrice && <s>{p.compareAtPrice}</s>}</p>
        {p.available === false && <p class="sc-soldout">Agotado</p>}
        <div class="sc-card-actions">
          {(p.actions ?? []).map((a) => (
            <button key={a.action} type="button" class="sc-chip" onClick={() => onAction(`${a.label}: ${p.title}`)}>{a.label}</button>
          ))}
        </div>
      </div>
    </article>
  );
}
