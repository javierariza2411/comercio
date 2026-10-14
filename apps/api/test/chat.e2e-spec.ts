import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { get as httpGet } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * e2e del chat: widget (sesión, mensajes, SSE replay, allowlist), agente con herramientas (mock provider),
 * simulador con traza, invalidación de caché al cambiar precio, handoff e inbox.
 */
describe('Chat + agente (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const run = Date.now().toString(36);
  const owner = { name: 'Dueña', email: `owner-${run}@test.com`, password: 'clave12345', businessName: `Chat Shop ${run}`, templateCode: 'generico' };
  let token: string;
  let tenantId: string;
  let widgetKey: string;
  let conversationId: string;
  let anonId: string;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-e2e-secret';
    process.env.AI_PROVIDER = 'disabled';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, 'http://localhost:3000');
    await app.listen(0);
    http = request(app.getHttpServer());

    const reg = await http.post('/auth/register').send(owner).expect(201);
    token = reg.body.accessToken;
    tenantId = reg.body.tenant.id;
    const key = await http.post('/tenants/me/widget-keys').set('Authorization', `Bearer ${token}`).send({ allowedDomains: ['mitienda.com'] }).expect(201);
    widgetKey = key.body.key;
    await http.post('/catalog/products').set('Authorization', `Bearer ${token}`).send({ name: 'Reloj Azul', priceCents: 25_000_000, stock: 3, trackStock: true, tags: ['azul'] }).expect(201);
    await http.post('/faq').set('Authorization', `Bearer ${token}`).send({ question: '¿Tienen garantía?', answer: 'Sí, 6 meses de garantía.', keywords: ['garantia'] }).expect(201);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
    await app.close();
  });

  const widget = (host = 'https://www.mitienda.com') => ({ 'X-Widget-Key': widgetKey, 'X-Widget-Host': host });

  it('rechaza claves inválidas y dominios no autorizados', async () => {
    await http.post('/widget/session').set({ 'X-Widget-Key': 'wk_nope' }).send({}).expect(401);
    await http.post('/widget/session').set(widget('https://otro.com')).send({}).expect(403);
    await http.post('/widget/session').set({ 'X-Widget-Key': widgetKey }).send({}).expect(403);
  });

  it('inicia sesión con bienvenida desde configuración y persiste el visitante', async () => {
    const res = await http.post('/widget/session').set(widget()).send({}).expect(201);
    conversationId = res.body.conversation.id;
    anonId = res.body.anonId;
    expect(res.body.config.assistantName).toBe('Asistente');
    expect(res.body.messages[0].role).toBe('BOT');
    expect(res.body.messages[0].content.text).toContain('Hola');

    const again = await http.post('/widget/session').set(widget()).send({ anonId }).expect(201);
    expect(again.body.conversation.id).toBe(conversationId);
    expect(again.body.conversation.isNew).toBe(false);
  });

  it('el agente responde con precio real desde la herramienta y adjunta tarjeta', async () => {
    await http.post(`/widget/conversations/${conversationId}/messages`).set(widget()).send({ text: '¿Cuánto cuesta el reloj azul?' }).expect(201);
    await wait(700);
    const history = await http.get(`/widget/conversations/${conversationId}/messages`).set(widget()).expect(200);
    const bot = history.body.filter((m: { role: string }) => m.role === 'BOT');
    const text = bot.find((m: { type: string; meta: { trace?: unknown } }) => m.type === 'TEXT' && m.meta.trace);
    expect(text.content.text).toContain('250.000');
    expect(text.meta.trace.tools.map((t: { name: string }) => t.name)).toContain('ver_precio_y_stock');
    expect(text.meta.trace.guardrail.passed).toBe(true);
    expect(bot.some((m: { type: string }) => m.type === 'PRODUCT_CARD')).toBe(true);
  });

  it('al cambiar el precio en el panel, la misma pregunta devuelve el dato nuevo (sin caché obsoleta)', async () => {
    const products = await http.get('/catalog/products').set('Authorization', `Bearer ${token}`).expect(200);
    await http.patch(`/catalog/products/${products.body[0].id}`).set('Authorization', `Bearer ${token}`).send({ priceCents: 19_900_000 }).expect(200);
    const sim = await http.post('/ai/simulate').set('Authorization', `Bearer ${token}`).send({ text: '¿Cuánto cuesta el reloj azul?' }).expect(201);
    expect(sim.body.reply).toContain('199.000');
    expect(sim.body.reply).not.toContain('250.000');
    expect(sim.body.trace.cached).toBe(false);
  });

  it('el simulador expone fuentes de conocimiento y no inventa cuando no hay datos', async () => {
    const faq = await http.post('/ai/simulate').set('Authorization', `Bearer ${token}`).send({ text: '¿qué garantía tienen?' }).expect(201);
    expect(faq.body.reply).toContain('6 meses');
    expect(faq.body.trace.sources[0].kind).toBe('faq');

    const hours = await http.post('/ai/simulate').set('Authorization', `Bearer ${token}`).send({ text: '¿cuál es el horario?' }).expect(201);
    expect(hours.body.effects.unknown).toBe(true);
    expect(hours.body.reply).toMatch(/no ha publicado/i);
  });

  it('SSE reenvía mensajes perdidos a partir de Last-Event-ID', async () => {
    const server = app.getHttpServer() as import('http').Server;
    const address = server.address() as import('net').AddressInfo;
    const data = await new Promise<string>((resolve, reject) => {
      const req = httpGet(
        `http://127.0.0.1:${address.port}/widget/conversations/${conversationId}/events?key=${widgetKey}&host=https://mitienda.com&lastEventId=1`,
        (res) => {
          let buffer = '';
          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            if (buffer.split('event: message').length > 2) {
              res.destroy();
              resolve(buffer);
            }
          });
          res.on('error', () => resolve(buffer));
        },
      );
      req.on('error', (e) => reject(e));
      setTimeout(() => { req.destroy(); reject(new Error('timeout SSE')); }, 5000);
    });
    expect(data).toContain('id: 2');
    expect(data).toContain('event: message');
  });

  it('pedir una persona transfiere la conversación; el bot calla y el agente responde desde el inbox', async () => {
    await http.post(`/widget/conversations/${conversationId}/messages`).set(widget()).send({ text: 'quiero hablar con una persona' }).expect(201);
    await wait(600);
    const waiting = await http.get('/inbox/conversations?status=WAITING_AGENT').set('Authorization', `Bearer ${token}`).expect(200);
    expect(waiting.body.map((c: { id: string }) => c.id)).toContain(conversationId);

    await http.patch(`/inbox/conversations/${conversationId}`).set('Authorization', `Bearer ${token}`).send({ assigneeId: 'me' }).expect(200);
    await http.post(`/inbox/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${token}`).send({ text: 'Hola, te atiendo yo.' }).expect(201);

    const before = (await http.get(`/widget/conversations/${conversationId}/messages`).set(widget())).body.length;
    await http.post(`/widget/conversations/${conversationId}/messages`).set(widget()).send({ text: 'gracias' }).expect(201);
    await wait(500);
    const after = (await http.get(`/widget/conversations/${conversationId}/messages`).set(widget())).body;
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1].role).toBe('VISITOR');
  });

  it('el inbox de otro tenant no ve esta conversación', async () => {
    const other = await http.post('/auth/register').send({ ...owner, email: `other-${run}@test.com`, businessName: `Otro ${run}` }).expect(201);
    await http.get(`/inbox/conversations/${conversationId}`).set('Authorization', `Bearer ${other.body.accessToken}`).expect(404);
    await prisma.tenant.delete({ where: { id: other.body.tenant.id } });
  });
});
