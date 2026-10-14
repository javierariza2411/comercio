import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export type ChatEventType = 'message' | 'typing' | 'status' | 'assigned';

export interface ChatEvent {
  type: ChatEventType;
  tenantId: string;
  conversationId: string;
  payload: unknown;
  id?: string;
}

/**
 * Bus de eventos en proceso para SSE. Con varias instancias de la API se sustituye por Redis pub/sub
 * detrás de la misma interfaz (publish/subscribe), sin tocar controladores.
 */
@Injectable()
export class ChatEvents {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event: ChatEvent) {
    this.emitter.emit(`conv:${event.conversationId}`, event);
    this.emitter.emit(`tenant:${event.tenantId}`, event);
  }

  subscribeConversation(conversationId: string, handler: (event: ChatEvent) => void) {
    const channel = `conv:${conversationId}`;
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  subscribeTenant(tenantId: string, handler: (event: ChatEvent) => void) {
    const channel = `tenant:${tenantId}`;
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }
}
