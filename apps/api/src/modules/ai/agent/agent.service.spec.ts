import { AgentService } from './agent.service';

/** Pruebas del guardrail de cifras y del router de modelo (lógica pura, sin BD ni LLM). */
describe('AgentService guardrails', () => {
  const service = new AgentService({} as never, {} as never, {} as never);
  const guard = (text: string, facts: string[]) => (service as unknown as { guardFigures: (t: string, f: string[]) => { text: string; stripped: string[] } }).guardFigures(text, facts);

  it('conserva importes que una herramienta devolvió', () => {
    const r = guard('El Diver Pro cuesta $ 799.900 y el envío $ 12.000.', ['$ 799.900', '$ 12.000']);
    expect(r.stripped).toEqual([]);
    expect(r.text).toContain('$ 799.900');
  });

  it('elimina importes inventados por el modelo', () => {
    const r = guard('Cuesta $ 799.900, pero hoy te lo dejo en $ 650.000 COP.', ['$ 799.900']);
    expect(r.stripped).toEqual(['$ 650.000']);
    expect(r.text).not.toContain('650.000');
    expect(r.text).toContain('[precio no disponible');
  });

  it('tolera diferencias de formato (1.349.900 vs 1349900)', () => {
    const r = guard('Sale en COP 1349900.', ['$ 1.349.900']);
    expect(r.stripped).toEqual([]);
  });

  it('elige modelo grande solo para consultas largas, múltiples o tras fallos repetidos', () => {
    const pick = (service as unknown as { pickTier: (bot: { modelTier: string }, input: { text: string; unknownStreak: number }) => string }).pickTier.bind(service);
    expect(pick({ modelTier: 'auto' }, { text: '¿precio?', unknownStreak: 0 })).toBe('small');
    expect(pick({ modelTier: 'auto' }, { text: '¿a? ¿b? ¿c?', unknownStreak: 0 })).toBe('large');
    expect(pick({ modelTier: 'auto' }, { text: 'x'.repeat(401), unknownStreak: 0 })).toBe('large');
    expect(pick({ modelTier: 'auto' }, { text: 'hola', unknownStreak: 2 })).toBe('large');
    expect(pick({ modelTier: 'small' }, { text: 'x'.repeat(900), unknownStreak: 5 })).toBe('small');
  });
});
