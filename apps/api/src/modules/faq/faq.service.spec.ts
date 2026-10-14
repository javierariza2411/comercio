import { FaqService, tokenize } from './faq.service';
import { PrismaService } from '../../prisma/prisma.module';

describe('FaqService', () => {
  const faqs = [
    { id: '1', question: '¿Hacen envíos?', answer: 'Sí, envíos nacionales.', keywords: ['envio', 'domicilio'], active: true },
    { id: '2', question: '¿Ofrecen garantía?', answer: 'Garantía de 12 meses.', keywords: ['garantia'], active: true },
    { id: '3', question: '¿Aceptan financiación?', answer: 'Sí, en cuotas.', keywords: ['cuotas'], active: true },
  ];
  const prisma = { faq: { findMany: vi.fn().mockResolvedValue(faqs) } } as unknown as PrismaService;
  const service = new FaqService(prisma);

  it('tokeniza quitando acentos y stopwords', () => {
    expect(tokenize('¿Cuál es la garantía de los relojes?')).toEqual(['garantia', 'relojes']);
  });

  it('prioriza coincidencias por keyword y no usa regex sobre la entrada', async () => {
    const result = await service.search('t1', 'hacen envío a domicilio? (.*)+');
    expect(result[0].id).toBe('1');
    expect(result.find((r) => r.id === '3')).toBeUndefined();
  });

  it('devuelve vacío si la consulta solo tiene stopwords', async () => {
    expect(await service.search('t1', 'de la el')).toEqual([]);
  });
});
