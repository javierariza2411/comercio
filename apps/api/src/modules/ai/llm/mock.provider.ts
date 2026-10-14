import { LlmProvider, LlmRequest, LlmResponse } from './provider';

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Proveedor determinista para desarrollo, pruebas y la suite de evaluación sin consumir tokens.
 * Decide herramientas por palabras clave y redacta la respuesta a partir de los resultados reales
 * de las herramientas (nunca inventa cifras). No sustituye a un LLM en producción.
 */
export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const usage = { inputTokens: Math.ceil(JSON.stringify(request.messages).length / 4), outputTokens: 40 };
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lastToolResults = this.collectToolResults(request);

    if (lastToolResults.length > 0) {
      return { text: this.compose(lastToolResults), toolCalls: [], usage, model: 'mock' };
    }

    const q = normalize(lastUser);
    const tools = new Set((request.tools ?? []).map((t) => t.name));
    const call = (name: string, args: Record<string, unknown>) =>
      tools.has(name) ? { text: '', toolCalls: [{ id: `${name}#0`, name, args }], usage, model: 'mock' } : null;

    if (/humano|persona|asesor|agente/.test(q)) return call('pasar_a_humano', { motivo: 'El visitante pidió hablar con una persona' }) ?? this.plain(usage, 'Te conecto con una persona.');
    if (/pedido|orden/.test(q) && /[A-Z]{2,5}-\d{6,}/i.test(lastUser)) {
      const match = lastUser.match(/[A-Z]{2,5}-\d{6,}-[A-Z0-9]+/i);
      return call('estado_pedido', { numero_pedido: match?.[0] ?? '' }) ?? this.plain(usage, 'No puedo consultar pedidos ahora.');
    }
    if (/horario|sede|direccion|ubicacion|donde quedan|abren|cierran/.test(q)) return call('ver_horarios_y_sedes', {}) ?? this.plain(usage, '');
    if (/envio|domicilio|entrega/.test(q)) {
      const city = lastUser.match(/\b(?:a|en|para)\s+([A-ZÁÉÍÓÚ][\wáéíóú]+)/)?.[1];
      return call('calcular_envio', { ciudad: city ?? '' }) ?? this.plain(usage, '');
    }
    if (/promo|descuento|oferta|rebaja/.test(q)) return call('ver_promociones', {}) ?? this.plain(usage, '');
    if (/catalogo|pdf|fotos|galeria/.test(q)) return call('enviar_catalogo', {}) ?? this.plain(usage, '');
    if (/precio|cuanto cuesta|cuanto vale|stock|disponible|hay\b/.test(q)) return call('ver_precio_y_stock', { consulta: lastUser }) ?? this.plain(usage, '');
    if (/garantia|politica|devolucion|cambio|pago|tarjeta|transferencia|talla/.test(q)) return call('buscar_conocimiento', { pregunta: lastUser }) ?? this.plain(usage, '');
    if (/correo|telefono|contact|mis datos/.test(q) && /@|\d{7,}/.test(lastUser)) {
      return call('capturar_lead', this.extractLead(lastUser)) ?? this.plain(usage, '');
    }
    return call('buscar_productos', { consulta: lastUser }) ?? this.plain(usage, 'Cuéntame qué producto buscas.');
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Embedding de juguete (bolsa de caracteres) suficiente para pruebas de plomería; no para producción.
    return texts.map((text) => {
      const vector = new Array(64).fill(0);
      for (const char of normalize(text)) vector[char.charCodeAt(0) % 64] += 1;
      const norm = Math.hypot(...vector) || 1;
      return vector.map((v) => v / norm);
    });
  }

  private plain(usage: LlmResponse['usage'], text: string): LlmResponse {
    return { text: text || 'No tengo esa información. ¿Quieres que te conecte con una persona?', toolCalls: [], usage, model: 'mock' };
  }

  private collectToolResults(request: LlmRequest) {
    const results: Array<{ name: string; result: unknown }> = [];
    for (let i = request.messages.length - 1; i >= 0; i--) {
      const m = request.messages[i];
      if (m.role === 'tool') results.unshift({ name: m.toolName ?? '', result: m.toolResult });
      else if (m.role === 'user') break;
    }
    return results;
  }

  private compose(results: Array<{ name: string; result: unknown }>): string {
    const lines: string[] = [];
    for (const { name, result } of results) {
      const r = result as Record<string, unknown>;
      if (r?.error) { lines.push(String(r.error)); continue; }
      switch (name) {
        case 'buscar_productos':
        case 'ver_precio_y_stock': {
          const items = (r.productos as Array<Record<string, unknown>>) ?? [];
          if (!items.length) { lines.push('No encontré productos que coincidan. ¿Me das más detalles?'); break; }
          lines.push(items.length === 1 ? 'Esto es lo que encontré:' : 'Estas opciones pueden interesarte:');
          for (const p of items.slice(0, 3)) lines.push(`• ${p.nombre}: ${p.precio}${p.disponible === false ? ' (agotado)' : ''}`);
          break;
        }
        case 'ver_promociones': {
          const promos = (r.promociones as Array<Record<string, unknown>>) ?? [];
          lines.push(promos.length ? `Promociones vigentes: ${promos.map((p) => `${p.nombre} (${p.descuento})`).join(', ')}.` : String(r.mensaje ?? 'No hay promociones vigentes.'));
          break;
        }
        case 'ver_horarios_y_sedes': {
          const sedes = (r.sedes as Array<Record<string, unknown>>) ?? [];
          lines.push(sedes.length ? sedes.map((s) => `${s.nombre}: ${s.direccion}. Horario: ${s.horario}`).join('\n') : String(r.mensaje ?? 'El comercio no ha publicado sedes.'));
          break;
        }
        case 'calcular_envio':
          lines.push(String(r.mensaje ?? 'No pude calcular el envío.'));
          break;
        case 'estado_pedido':
          lines.push(String(r.mensaje ?? 'No encontré ese pedido.'));
          break;
        case 'buscar_conocimiento': {
          const frags = (r.fragmentos as Array<Record<string, unknown>>) ?? [];
          lines.push(frags.length ? String(frags[0].texto) : 'No tengo esa información publicada. ¿Quieres hablar con una persona?');
          break;
        }
        case 'enviar_catalogo':
          lines.push(String(r.mensaje ?? 'Aquí tienes nuestro catálogo.'));
          break;
        case 'capturar_lead':
          lines.push(String(r.mensaje ?? '¡Gracias! Guardamos tus datos.'));
          break;
        case 'pasar_a_humano':
          lines.push(String(r.mensaje ?? 'Te estamos conectando con una persona.'));
          break;
        default:
          lines.push(JSON.stringify(result).slice(0, 300));
      }
    }
    return lines.join('\n');
  }

  private extractLead(text: string) {
    return {
      nombre: text.match(/(?:soy|me llamo)\s+([A-ZÁÉÍÓÚa-záéíóú]+(?:\s[A-ZÁÉÍÓÚa-záéíóú]+)?)/)?.[1] ?? '',
      correo: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? '',
      telefono: text.match(/\+?\d[\d\s-]{6,}\d/)?.[0]?.replace(/\s|-/g, '') ?? '',
      consentimiento: true,
    };
  }
}
