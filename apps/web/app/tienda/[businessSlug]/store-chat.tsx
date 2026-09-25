'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUp, Check, MessageCircle, Watch, X } from 'lucide-react';

type Product = {
  name: string;
  price: number;
  description: string;
  intent: string;
};

type ChatMessage = {
  id: number;
  role: 'assistant' | 'visitor';
  text: string;
  product?: Product;
};

const products: Product[] = [
  { name: 'Chronos Automatic Classic', price: 649900, description: 'Automático, acero inoxidable y diseño atemporal.', intent: 'automatico' },
  { name: 'Chronos Diver Pro', price: 799900, description: 'Titanio y resistencia al agua de hasta 300 m.', intent: 'deportivo' },
  { name: 'Chronos Urban', price: 529900, description: 'Cuarzo, perfil ligero y estilo para cada día.', intent: 'diario' },
  { name: 'Chronos Elegance', price: 899900, description: 'Acabado refinado para ocasiones especiales.', intent: 'elegante' },
  { name: 'Chronos Smart One', price: 1099900, description: 'Funciones inteligentes en un diseño premium.', intent: 'smartwatch' },
];

const quickReplies = ['Recomiéndame un reloj', 'Envíos y garantía', 'Hablar por WhatsApp'];
const formatPrice = (price: number) => `$${price.toLocaleString('es-CO')} COP`;

function respondTo(message: string): { text: string; product?: Product; replies: string[] } {
  const normalized = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/envio|garantia|devolucion|pago/.test(normalized)) {
    return {
      text: 'Tenemos envío gratuito en Colombia y 12 meses de garantía. Para confirmar tiempos de entrega o medios de pago en tu ciudad, nuestro equipo te ayuda por WhatsApp.',
      replies: ['Ver relojes deportivos', 'Hablar por WhatsApp'],
    };
  }

  if (/whatsapp|asesor|persona|humano|comprar/.test(normalized)) {
    return {
      text: 'Claro. Puedes escribirle directamente a un asesor de Chronos y continuar tu compra por WhatsApp.',
      replies: ['Recomiéndame un reloj', 'Envíos y garantía'],
    };
  }

  let product: Product | undefined;
  if (/deport|buce|aventura|agua/.test(normalized)) product = products.find((item) => item.intent === 'deportivo');
  else if (/smart|digital|notificacion|tecnolog/.test(normalized)) product = products.find((item) => item.intent === 'smartwatch');
  else if (/eleg|formal|especial/.test(normalized)) product = products.find((item) => item.intent === 'elegante');
  else if (/automatic|clasico|tradicional/.test(normalized)) product = products.find((item) => item.intent === 'automatico');
  else if (/diario|casual|presupuesto|econom|700|barato/.test(normalized)) product = products.find((item) => item.intent === 'diario');

  if (product) {
    return {
      text: 'Por lo que buscas, este modelo puede encajarte:',
      product,
      replies: ['Ver otra opción', 'Envíos y garantía', 'Hablar por WhatsApp'],
    };
  }

  return {
    text: 'Te ayudo a encontrar uno. ¿Qué estilo tienes en mente?',
    replies: ['Deportivo', 'Elegante', 'Automático', 'Smartwatch', 'Para uso diario'],
  };
}

export default function StoreChat({ businessSlug }: { businessSlug: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replies, setReplies] = useState(quickReplies);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', text: '¡Hola! Soy el asistente de Chronos. Puedo ayudarte a elegir un reloj o resolver dudas sobre tu compra.' },
  ]);

  function sendMessage(value: string) {
    const text = value.trim();
    if (!text) return;
    const response = respondTo(text);
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

  const whatsappUrl = (product?: Product) => {
    const text = product
      ? `Hola, vi ${product.name} en la tienda ${businessSlug} y quisiera más información.`
      : 'Hola, quisiera más información sobre los relojes Chronos.';
    return `https://wa.me/573001234567?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7">
      {open && (
        <section aria-label="Asistente de Chronos Watches" className="mb-4 flex h-[min(620px,calc(100dvh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20">
          <header className="flex items-center justify-between bg-[#17211d] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#c8a66a] text-[#17211d]"><Watch size={19} /></span>
              <div>
                <p className="font-semibold">Asistente Chronos</p>
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
                      <div className="flex h-24 items-center justify-center bg-[linear-gradient(135deg,#e5e1d8,#f5f1e8_52%,#d7c39d)] text-[#4b5145]"><Watch size={34} strokeWidth={1.2} /></div>
                      <div className="p-3">
                        <p className="font-semibold text-stone-900">{message.product.name}</p>
                        <p className="mt-1 text-xs text-stone-500">{message.product.description}</p>
                        <p className="mt-2 font-semibold text-stone-900">{formatPrice(message.product.price)}</p>
                        <a href={whatsappUrl(message.product)} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#26372e] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#354b3e]">Consultar por WhatsApp <ArrowUp size={14} /></a>
                      </div>
                    </div>
                  )}
                  {message.role === 'assistant' && !message.product && /WhatsApp/.test(message.text) && (
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

      <button onClick={() => setOpen((current) => !current)} aria-label={open ? 'Cerrar asistente' : 'Abrir asistente de Chronos'} className="ml-auto flex h-14 items-center gap-3 rounded-full bg-[#26372e] px-5 text-white shadow-lg shadow-stone-900/20 transition-colors hover:bg-[#354b3e]">
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span className="text-sm font-semibold">{open ? 'Cerrar' : '¿Te ayudo a elegir?'}</span>
      </button>
    </div>
  );
}