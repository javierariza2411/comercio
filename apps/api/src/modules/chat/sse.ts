import { Response } from 'express';
import { ChatEvent } from './chat-events';

/** Prepara una respuesta HTTP como stream SSE y devuelve el escritor de eventos. */
export function openSse(res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (event: ChatEvent | { type: string; payload: unknown; id?: string }) => {
    if (event.id) res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
  };
  // Comentario periódico para mantener viva la conexión a través de proxies.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  const close = () => clearInterval(heartbeat);
  return { write, close };
}
