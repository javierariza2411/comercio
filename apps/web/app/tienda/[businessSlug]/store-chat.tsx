'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUp, Check, MessageCircle, ShoppingBag, X } from 'lucide-react';

import { formatMoney } from '@smartcommerce/shared';

export type ChatProduct = {
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  description: string;
  category: string;
  tags: string[];
};

type ChatMessage = {
  id: number;
  role: 'assistant' | 'visitor';
  text: string;
  product?: ChatProduct;
};

export type StoreChatProps = {
  businessSlug: string;
  storeName: string;
  assistantName?: string;
  welcomeMessage?: string;
  whatsappNumber?: string;
  products: ChatProduct[];
};

const quickReplies = ['Pagos y cuenta', 'Envíos', 'Garantía', 'Cambios y devoluciones'];

const normalize = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Respuestas basadas en reglas para la demo del storefront. No inventa datos del comercio:
 * cuando la información no está publicada, lo dice. En Fase 1 se reemplaza por el widget + RAG.
 */
function respondTo(message: string, products: ChatProduct[], storeName: string): { text: string; product?: ChatProduct; replies: string[] } {
  const normalized = normalize(message);

  if (/cuenta|numero de cuenta|consignacion|transferencia|bancari/.test(normalized)) {
    return {
      text: 'Los datos bancarios oficiales aparecen al crear tu pedido en la tienda. No hagas transferencias a cuentas que no se muestren allí.',
      replies: ['Medios de pago', 'Envíos', 'Garantía'],
    };
  }

  if (/pago|tarjeta|pse|efectivo|contraentrega/.test(normalized)) {
    return {
      text: 'Por ahora el comercio recibe pagos por transferencia bancaria al crear el pedido. Otros medios de pago aún no están publicados.',
      replies: ['Número de cuenta', 'Envíos', 'Garantía'],
    };
  }

  if (/garantia|envio|entrega|domicilio|devolucion|cambio|reembolso/.test(normalized)) {
    return {
      text: `Esa política todavía no está publicada por ${storeName}. Confírmala con el comercio antes de completar tu compra.`,
      replies: ['Medios de pago', 'Recomiéndame un producto', 'Hablar con una persona'],
    };
  }

  if (/whatsapp|asesor|persona|humano/.test(normalized)) {
    return {
      text: `Claro. Puedes escribirle directamente a un asesor de ${storeName} y continuar por WhatsApp.`,
      replies: ['Recomiéndame un producto', 'Medios de pago'],
    };
  }

  // Recomendación simple: puntúa productos por coincidencia de tokens con nombre, categoría, tags y descripción.
  const tokens = normalized.split(/[^a-z0-9ñ]+/).filter((token) => token.length > 3);
  const scored = products
    .map((product) => {
      const haystack = normalize(`${product.name} ${product.category} ${product.tags.join(' ')} ${product.description}`);
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) {
    return {
      text: 'Por lo que buscas, esta opción puede encajarte:',
      product: scored[0].product,
      replies: ['Ver otra opción', 'Medios de pago', 'Hablar con una persona'],
    };
  }

  return {
    text: 'Puedo ayudarte a elegir un producto o resolver dudas antes de comprar. ¿Qué necesitas saber?',
    replies: ['Recomiéndame un producto', 'Pagos y cuenta', 'Envíos', 'Garantía'],
  };
}

export default function StoreChat({ businessSlug, storeName, assistantName, welcomeMessage, whatsappNumber, products }: StoreChatProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replies, setReplies] = useState(quickReplies);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', text: welcomeMessage || `¡Hola! Soy el asistente de ${storeName}. Puedo ayudarte a elegir un producto o resolver dudas sobre tu compra.` },
  ]);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener('open-store-assistant', openAssistant);
    return () => window.removeEventListener('open-store-assistant', openAssistant);
  }, []);

  function sendMessage(value: string) {
    const text = value.trim();
    if (!text) return;
    const response = respondTo(text, products, storeName);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'visitor', text },
      { id: Date.now() + 1, role: 'assistant', ...response },
    ]);
    setReplies(response.replies);
    setDraft('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  const whatsappUrl = (product?: ChatProduct) => {
    const text = product
      ? `Hola, vi ${product.name} en la tienda ${businessSlug} y quisiera más información.`
      : `Hola, quisiera más información sobre los productos de ${storeName}.`;
    const phone = (whatsappNumber || '').replace(/\D/g, '');
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : '';
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
      {open && (
        <section aria-label={`Asistente de ${storeName}`} className="mb-4 flex h-[min(620px,calc(100dvh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20">
          <header className="flex items-center justify-between bg-[#17211d] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#c8a66a] text-[#17211d]"><MessageCircle size={19} /></span>
              <div>
                <p className="font-semibold">{assistantName || `Asistente ${storeName}`}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-300"><span className="size-1.5 rounded-full bg-emerald-400" /> Disponible ahora</p>
              </div>
            </div>
            <button aria-label="Cerrar chat" onClick={() => setOpen(false)} className="rounded-md p-2 text-stone-300 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </header>

          <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto bg-[#f7f6f2] px-4 py-5">
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-stone-400">Atención de tienda · Demo</p>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'visitor' ? 'rounded-br-sm bg-[#24352d] text-white' : 'rounded-bl-sm border border-stone-200 bg-white text-stone-700'}`}>
                  <p>{message.text}</p>
                  {message.product && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                      <div className="flex h-24 items-center justify-center bg-[linear-gradient(135deg,#e5e1d8,#f5f1e8_52%,#d7c39d)] text-[#4b5145]"><ShoppingBag size={34} strokeWidth={1.2} /></div>
                      <div className="p-3">
                        <p className="font-semibold text-stone-900">{message.product.name}</p>
                        <p className="mt-1 text-xs text-stone-500">{message.product.description}</p>
                        <p className="mt-2 font-semibold text-stone-900">{formatMoney(message.product.priceCents, message.product.currency)}</p>
                        <button onClick={() => setOpen(false)} className="mt-3 w-full bg-[#26372e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#354b3e]">Seguir explorando la tienda</button>
                      </div>
                    </div>
                  )}
                  {message.role === 'assistant' && !message.product && /WhatsApp/.test(message.text) && whatsappUrl() && (
                    <a href={whatsappUrl()} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#26372e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#354b3e]">Abrir WhatsApp <ArrowUp size={14} /></a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-200 bg-white px-4 pb-4 pt-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {replies.map((reply) => (
                <button key={reply} onClick={() => sendMessage(reply)} className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-[#596b5e] hover:bg-stone-50">{reply}</button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white p-1.5 pl-3 focus-within:border-[#596b5e]">
              <input aria-label="Escribe tu pregunta" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe tu pregunta..." className="min-w-0 flex-1 bg-transparent py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400" />
              <button type="submit" aria-label="Enviar mensaje" disabled={!draft.trim()} className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#26372e] text-white transition hover:bg-[#354b3e] disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={17} /></button>
            </form>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-stone-400"><Check size={11} /> Respuestas automáticas de demostración</p>
          </div>
        </section>
      )}

      <button onClick={() => setOpen((current) => !current)} aria-label={open ? 'Cerrar asistente' : `Abrir asistente de ${storeName}`} className="ml-auto flex h-14 items-center gap-3 rounded-full bg-[#26372e] px-5 text-white shadow-lg shadow-stone-900/20 transition-colors hover:bg-[#354b3e]">
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span className="text-sm font-semibold">{open ? 'Cerrar' : 'Resuelve tus dudas'}</span>
      </button>
    </div>
  );
}