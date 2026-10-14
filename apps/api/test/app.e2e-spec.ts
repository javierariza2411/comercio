import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Pruebas e2e contra Postgres real (DATABASE_URL). Cada ejecución crea dos tenants con
 * prefijo único y los elimina al terminar. Requiere `npx prisma migrate deploy` previo.
 */
describe('SmartCommerce API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prisma = new PrismaClient();
  const run = Date.now().toString(36);

  const tenantA = { name: 'Ana', email: `ana-${run}@test.com`, password: 'clave12345', businessName: `Tienda A ${run}` };
  const tenantB = { name: 'Beto', email: `beto-${run}@test.com`, password: 'clave12345', businessName: `Tienda B ${run}` };
  let tokenA: string;
  let refreshA: string;
  let tokenB: string;
  let slugA: string;
  let productAId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret-e2e-secret-e2e-secret-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, 'http://localhost:3000');
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { name: { endsWith: run } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('auth', () => {
    it('rechaza registros inválidos con 400 (antes devolvía 500)', async () => {
      await http.post('/auth/register').send({}).expect(400);
      await http.post('/auth/register').send({ ...tenantA, password: 'corta' }).expect(400);
    });

    it('registra dos tenants y devuelve access + refresh', async () => {
      const resA = await http.post('/auth/register').send(tenantA).expect(201);
      tokenA = resA.body.accessToken;
      refreshA = resA.body.refreshToken;
      slugA = resA.body.tenant.slug;
      expect(resA.body.user.role).toBe('OWNER');
      expect(resA.body.tenant.id).toBeDefined();

      const resB = await http.post('/auth/register').send(tenantB).expect(201);
      tokenB = resB.body.accessToken;
      expect(resB.body.tenant.id).not.toBe(resA.body.tenant.id);
    });

    it('no permite dos cuentas con el mismo correo', async () => {
      await http.post('/auth/register').send(tenantA).expect(409);
    });

    it('login y /auth/me', async () => {
      const res = await http.post('/auth/login').send({ email: tenantA.email, password: tenantA.password }).expect(200);
      expect(res.body.accessToken).toBeDefined();
      const me = await http.get('/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
      expect(me.body.email).toBe(tenantA.email);
    });

    it('rota el refresh token y rechaza su reutilización', async () => {
      const rotated = await http.post('/auth/refresh').send({ refreshToken: refreshA }).expect(200);
      expect(rotated.body.refreshToken).not.toBe(refreshA);
      await http.post('/auth/refresh').send({ refreshToken: refreshA }).expect(401);
      await http.post('/auth/logout').send({ refreshToken: rotated.body.refreshToken }).expect(200);
      await http.post('/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
    });

    it('rechaza peticiones sin token', async () => {
      await http.get('/tenants/me').expect(401);
      await http.get('/catalog/products').expect(401);
    });
  });

  describe('aislamiento multi-tenant', () => {
    it('crea categoría y producto en el tenant A', async () => {
      const cat = await http
        .post('/catalog/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Relojes' })
        .expect(201);
      expect(cat.body.slug).toBe('relojes');

      const product = await http
        .post('/catalog/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Reloj Uno', priceCents: 150_000_00, categoryId: cat.body.id, stock: 2, trackStock: true })
        .expect(201);
      productAId = product.body.id;
      expect(product.body.slug).toBe('reloj-uno');
    });

    it('rechaza tenantId en el body (no se puede suplantar el tenant)', async () => {
      const res = await http
        .post('/catalog/products')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hack', priceCents: 100, tenantId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('tenantId');
    });

    it('el tenant B no ve ni modifica recursos del tenant A', async () => {
      const list = await http.get('/catalog/products').set('Authorization', `Bearer ${tokenB}`).expect(200);
      expect(list.body).toHaveLength(0);
      await http.get(`/catalog/products/${productAId}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
      await http.patch(`/catalog/products/${productAId}`).set('Authorization', `Bearer ${tokenB}`).send({ name: 'X' }).expect(404);
      await http.delete(`/catalog/products/${productAId}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    });

    it('el catálogo público devuelve solo productos del slug consultado', async () => {
      const res = await http.get(`/catalog/public/${slugA}`).expect(200);
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe('Reloj Uno');
      await http.get('/catalog/public/slug-inexistente').expect(404);
    });

    it('no existe un listado global de tenants', async () => {
      await http.get('/tenants').set('Authorization', `Bearer ${tokenA}`).expect(404);
      await http.get('/businesses').set('Authorization', `Bearer ${tokenA}`).expect(404);
    });

    it('las FAQ se filtran por tenant', async () => {
      await http
        .post('/faq')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ question: '¿Hacen envíos?', answer: 'Sí, a todo el país.', keywords: ['envio'] })
        .expect(201);
      const own = await http.post('/faq/search').set('Authorization', `Bearer ${tokenA}`).send({ query: 'envíos' }).expect(200);
      expect(own.body).toHaveLength(1);
      const other = await http.post('/faq/search').set('Authorization', `Bearer ${tokenB}`).send({ query: 'envíos' }).expect(200);
      expect(other.body).toHaveLength(0);
    });
  });

  describe('roles', () => {
    let agentToken: string;

    beforeAll(async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { email: tenantA.email } });
      const agent = await prisma.user.create({
        data: {
          tenantId: owner.tenantId,
          name: 'Agente',
          email: `agente-${run}@test.com`,
          passwordHash: owner.passwordHash,
          role: 'AGENT',
        },
      });
      expect(agent.id).toBeDefined();
      const res = await http.post('/auth/login').send({ email: agent.email, password: tenantA.password }).expect(200);
      agentToken = res.body.accessToken;
    });

    it('AGENT puede leer pero no configurar el comercio', async () => {
      await http.get('/tenants/me').set('Authorization', `Bearer ${agentToken}`).expect(200);
      await http.patch('/tenants/me').set('Authorization', `Bearer ${agentToken}`).send({ name: 'Nuevo' }).expect(403);
      await http.post('/catalog/products').set('Authorization', `Bearer ${agentToken}`).send({ name: 'X', priceCents: 1 }).expect(403);
      await http.patch('/orders/SC-X/confirm-transfer').set('Authorization', `Bearer ${agentToken}`).expect(403);
    });

    it('OWNER actualiza settings con merge parcial', async () => {
      const res = await http
        .patch('/tenants/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ chatSettings: { tone: 'formal' } })
        .expect(200);
      expect(res.body.chatSettings).toMatchObject({ tone: 'formal', enabled: true, aiEnabled: false });
    });
  });

  describe('pedidos por transferencia', () => {
    const customer = { name: 'Cliente', phone: '3001234567', city: 'Bogotá', address: 'Calle 1 # 2-3' };

    it('rechaza pedidos si el comercio no configuró la cuenta bancaria', async () => {
      await http
        .post(`/orders/${slugA}/bank-transfer`)
        .send({ ...customer, items: [{ productSlug: 'reloj-uno', quantity: 1 }] })
        .expect(400);
    });

    it('configura la cuenta, crea el pedido y descuenta stock', async () => {
      await http
        .patch('/tenants/me/payment-settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ bankTransferEnabled: true, bankName: 'Banco', accountNumber: '123456', accountHolder: 'Tienda A' })
        .expect(200);

      const pub = await http.get(`/tenants/public/${slugA}`).expect(200);
      expect(pub.body.paymentSettings.accountNumber).toBe('123456');

      const order = await http
        .post(`/orders/${slugA}/bank-transfer`)
        .send({ ...customer, items: [{ productSlug: 'reloj-uno', quantity: 1 }, { productSlug: 'reloj-uno', quantity: 1 }] })
        .expect(201);
      expect(order.body.totalCents).toBe(300_000_00);

      const product = await prisma.product.findUniqueOrThrow({ where: { id: productAId } });
      expect(product.stock).toBe(0);

      await http
        .post(`/orders/${slugA}/bank-transfer`)
        .send({ ...customer, items: [{ productSlug: 'reloj-uno', quantity: 1 }] })
        .expect(400);

      const listA = await http.get('/orders').set('Authorization', `Bearer ${tokenA}`).expect(200);
      expect(listA.body).toHaveLength(1);
      const listB = await http.get('/orders').set('Authorization', `Bearer ${tokenB}`).expect(200);
      expect(listB.body).toHaveLength(0);

      await http.patch(`/orders/${order.body.orderNumber}/confirm-transfer`).set('Authorization', `Bearer ${tokenB}`).expect(404);
      const confirmed = await http
        .patch(`/orders/${order.body.orderNumber}/confirm-transfer`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(confirmed.body.status).toBe('PAID');
    });
  });
});
