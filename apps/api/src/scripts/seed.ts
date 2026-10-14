import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed de plataforma (planes + plantillas de industria) y de un tenant demo creado DESDE la plantilla
 * "relojeria". Ningún default de negocio vive en el código de la API: todo sale de estas plantillas.
 */
const prisma = new PrismaClient();

const TENANT_SLUG = 'chronos-watches';
const ADMIN_EMAIL = 'admin@chronoswatches.com';
const ADMIN_PASSWORD = 'admin12345';

// ---------------------------------------------------------------------------
// Planes (límites editables en BD; estos son los valores iniciales)
// ---------------------------------------------------------------------------
const plans = [
  { code: 'FREE' as const, name: 'Prueba', limits: { conversationsPerMonth: 100, aiMessagesPerMonth: 300, agents: 1, storageMb: 100, productsMax: 50, imagesPerProduct: 3, orderMaxItems: 10, orderMaxQtyPerItem: 5, knowledgeSourcesMax: 3 }, features: { storefront: true, whatsapp: false, webhooks: false, whiteLabel: false } },
  { code: 'BASIC' as const, name: 'Básico', limits: { conversationsPerMonth: 1000, aiMessagesPerMonth: 3000, agents: 2, storageMb: 1000, productsMax: 500, imagesPerProduct: 5, orderMaxItems: 20, orderMaxQtyPerItem: 10, knowledgeSourcesMax: 10 }, features: { storefront: true, whatsapp: false, webhooks: true, whiteLabel: false } },
  { code: 'PRO' as const, name: 'Pro', limits: { conversationsPerMonth: 5000, aiMessagesPerMonth: 15000, agents: 5, storageMb: 5000, productsMax: 5000, imagesPerProduct: 8, orderMaxItems: 50, orderMaxQtyPerItem: 50, knowledgeSourcesMax: 50 }, features: { storefront: true, whatsapp: true, webhooks: true, whiteLabel: false } },
  { code: 'ENTERPRISE' as const, name: 'Empresa', limits: { conversationsPerMonth: 50000, aiMessagesPerMonth: 150000, agents: 50, storageMb: 50000, productsMax: 100000, imagesPerProduct: 12, orderMaxItems: 200, orderMaxQtyPerItem: 1000, knowledgeSourcesMax: 500 }, features: { storefront: true, whatsapp: true, webhooks: true, whiteLabel: true } },
];

// ---------------------------------------------------------------------------
// Plantillas de industria
// ---------------------------------------------------------------------------
const watchCategories = [
  { name: 'Automáticos', slug: 'automaticos', description: 'Relojes automáticos premium', sortOrder: 1 },
  { name: 'Cuarzo', slug: 'cuarzo', description: 'Relojes de cuarzo para uso diario', sortOrder: 2 },
  { name: 'Deportivos', slug: 'deportivos', description: 'Resistentes para actividad', sortOrder: 3 },
  { name: 'Elegantes', slug: 'elegantes', description: 'Diseño refinado para uso formal', sortOrder: 4 },
  { name: 'Smartwatches', slug: 'smartwatches', description: 'Tecnología y estilo en un solo reloj', sortOrder: 5 },
];

const watchProducts = [
    {
      categorySlug: 'automaticos',
      type: 'PRODUCT' as const,
      name: 'Chronos Automatic Classic',
      slug: 'chronos-automatic-classic',
      shortDescription: 'Reloj automático clásico con estilo sobrio.',
      description: 'Modelo ideal para quienes buscan elegancia, resistencia y tradición relojera.',
      priceCents: 649900 * 100,
      compareAtPriceCents: 749900 * 100,
      currency: 'COP',
      images: ['/images/chronos-automatic-classic.jpg'],
      active: true,
      featured: true,
      stock: 12,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '42 mm',
        material: 'Acero inoxidable',
        resistenciaAgua: '100 m',
        genero: 'Unisex',
      },
      tags: ['automatico', 'elegante', 'clásico'],
      metadata: { collection: 'Classic' },
    },
    {
      categorySlug: 'automaticos',
      type: 'PRODUCT' as const,
      name: 'Chronos Heritage',
      slug: 'chronos-heritage',
      shortDescription: 'Herencia y detalle en cada detalle.',
      description: 'Reloj automático con estética clásica y personalidad premium.',
      priceCents: 719900 * 100,
      compareAtPriceCents: 839900 * 100,
      currency: 'COP',
      images: ['/images/chronos-heritage.jpg'],
      active: true,
      featured: false,
      stock: 9,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '40 mm',
        material: 'Oro rosado',
        resistenciaAgua: '50 m',
        genero: 'Hombre',
      },
      tags: ['heritage', 'automático', 'premium'],
      metadata: { collection: 'Heritage' },
    },
    {
      categorySlug: 'deportivos',
      type: 'PRODUCT' as const,
      name: 'Chronos Diver Pro',
      slug: 'chronos-diver-pro',
      shortDescription: 'Para aventuras de alto rendimiento.',
      description: 'Diseñado para quienes exigen resistencia, precisión y estilo extremo.',
      priceCents: 799900 * 100,
      compareAtPriceCents: 929900 * 100,
      currency: 'COP',
      images: ['/images/chronos-diver-pro.jpg'],
      active: true,
      featured: true,
      stock: 15,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '44 mm',
        material: 'Titanio',
        resistenciaAgua: '300 m',
        genero: 'Unisex',
      },
      tags: ['deportivo', 'diver', 'titanio'],
      metadata: { collection: 'Adventure' },
    },
    {
      categorySlug: 'deportivos',
      type: 'PRODUCT' as const,
      name: 'Chronos Sport X',
      slug: 'chronos-sport-x',
      shortDescription: 'Reloj deportivo con diseño dinámico.',
      description: 'Ligero, robusto y listo para el día a día activo.',
      priceCents: 689900 * 100,
      compareAtPriceCents: 769900 * 100,
      currency: 'COP',
      images: ['/images/chronos-sport-x.jpg'],
      active: true,
      featured: false,
      stock: 20,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Cuarzo',
        diametro: '41 mm',
        material: 'Aluminio',
        resistenciaAgua: '100 m',
        genero: 'Hombre',
      },
      tags: ['deportivo', 'cuarzo', 'activo'],
      metadata: { collection: 'Sport' },
    },
    {
      categorySlug: 'cuarzo',
      type: 'PRODUCT' as const,
      name: 'Chronos Urban',
      slug: 'chronos-urban',
      shortDescription: 'Versátil para ciudad y reuniones.',
      description: 'Reloj de cuarzo con estilo sobrio para el uso diario.',
      priceCents: 529900 * 100,
      compareAtPriceCents: 619900 * 100,
      currency: 'COP',
      images: ['/images/chronos-urban.jpg'],
      active: true,
      featured: true,
      stock: 18,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Cuarzo',
        diametro: '38 mm',
        material: 'Acero inoxidable',
        resistenciaAgua: '50 m',
        genero: 'Mujer',
      },
      tags: ['urban', 'cuarzo', 'diario'],
      metadata: { collection: 'Urban' },
    },
    {
      categorySlug: 'cuarzo',
      type: 'PRODUCT' as const,
      name: 'Chronos Everyday',
      slug: 'chronos-everyday',
      shortDescription: 'Estilo discreto para cada día.',
      description: 'Simple, funcional y de fácil combinación con cualquier outfit.',
      priceCents: 459900 * 100,
      compareAtPriceCents: 549900 * 100,
      currency: 'COP',
      images: ['/images/chronos-everyday.jpg'],
      active: true,
      featured: false,
      stock: 34,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Cuarzo',
        diametro: '36 mm',
        material: 'Acero inoxidable',
        resistenciaAgua: '30 m',
        genero: 'Unisex',
      },
      tags: ['diario', 'cuarzo', 'minimalista'],
      metadata: { collection: 'Everyday' },
    },
    {
      categorySlug: 'elegantes',
      type: 'PRODUCT' as const,
      name: 'Chronos Elegance',
      slug: 'chronos-elegance',
      shortDescription: 'Reloj premium para ocasiones especiales.',
      description: 'Elegancia discreta con materiales de alta gama y diseño refinado.',
      priceCents: 899900 * 100,
      compareAtPriceCents: 1049900 * 100,
      currency: 'COP',
      images: ['/images/chronos-elegance.jpg'],
      active: true,
      featured: true,
      stock: 11,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '39 mm',
        material: 'Oro blanco',
        resistenciaAgua: '50 m',
        genero: 'Mujer',
      },
      tags: ['elegante', 'premium', 'formal'],
      metadata: { collection: 'Elegance' },
    },
    {
      categorySlug: 'elegantes',
      type: 'PRODUCT' as const,
      name: 'Chronos Noir',
      slug: 'chronos-noir',
      shortDescription: 'Negro, sobrio y sofisticado.',
      description: 'Un clásico con presencia, detalles pulidos y un diseño inolvidable.',
      priceCents: 959900 * 100,
      compareAtPriceCents: 1124900 * 100,
      currency: 'COP',
      images: ['/images/chronos-noir.jpg'],
      active: true,
      featured: false,
      stock: 8,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '41 mm',
        material: 'Acero negro',
        resistenciaAgua: '100 m',
        genero: 'Hombre',
      },
      tags: ['premium', 'negro', 'sofisticado'],
      metadata: { collection: 'Noir' },
    },
    {
      categorySlug: 'smartwatches',
      type: 'PRODUCT' as const,
      name: 'Chronos Smart One',
      slug: 'chronos-smart-one',
      shortDescription: 'Conectividad moderna con estilo premium.',
      description: 'Smartwatch con interfaz práctica, monitoreo diario y diseño elegante.',
      priceCents: 1099900 * 100,
      compareAtPriceCents: 1269900 * 100,
      currency: 'COP',
      images: ['/images/chronos-smart-one.jpg'],
      active: true,
      featured: true,
      stock: 14,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Digital',
        diametro: '45 mm',
        material: 'Aluminio',
        resistenciaAgua: '50 m',
        genero: 'Unisex',
      },
      tags: ['smartwatch', 'tecnología', 'digital'],
      metadata: { collection: 'Smart' },
    },
    {
      categorySlug: 'smartwatches',
      type: 'PRODUCT' as const,
      name: 'Chronos Pulse',
      slug: 'chronos-pulse',
      shortDescription: 'Reloj con monitoreo inteligente.',
      description: 'Ideal para quienes buscan tecnología, estilo y salud conectada.',
      priceCents: 1199900 * 100,
      compareAtPriceCents: 1349900 * 100,
      currency: 'COP',
      images: ['/images/chronos-pulse.jpg'],
      active: true,
      featured: false,
      stock: 10,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Digital',
        diametro: '46 mm',
        material: 'Silicona y aluminio',
        resistenciaAgua: '100 m',
        genero: 'Hombre',
      },
      tags: ['pulse', 'smartwatch', 'salud'],
      metadata: { collection: 'Pulse' },
    },
    {
      categorySlug: 'automaticos',
      type: 'PRODUCT' as const,
      name: 'Chronos Executive',
      slug: 'chronos-executive',
      shortDescription: 'Un reloj que habla de liderazgo.',
      description: 'Diseño lujoso, preciso y muy sofisticado para ambientes profesionales.',
      priceCents: 1349900 * 100,
      compareAtPriceCents: 1489900 * 100,
      currency: 'COP',
      images: ['/images/chronos-executive.jpg'],
      active: true,
      featured: true,
      stock: 6,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Automático',
        diametro: '42 mm',
        material: 'Acero inoxidable',
        resistenciaAgua: '80 m',
        genero: 'Hombre',
      },
      tags: ['executive', 'premium', 'automático'],
      metadata: { collection: 'Executive' },
    },
    {
      categorySlug: 'deportivos',
      type: 'PRODUCT' as const,
      name: 'Chronos Trail',
      slug: 'chronos-trail',
      shortDescription: 'Reloj listo para recorrer senderos y rutas.',
      description: 'Diseño ligero y robusto para actividades intensas y uso cotidiano.',
      priceCents: 739900 * 100,
      compareAtPriceCents: 839900 * 100,
      currency: 'COP',
      images: ['/images/chronos-trail.jpg'],
      active: true,
      featured: false,
      stock: 19,
      trackStock: true,
      attributes: {
        marca: 'Chronos',
        movimiento: 'Cuarzo',
        diametro: '43 mm',
        material: 'Nylon y acero',
        resistenciaAgua: '200 m',
        genero: 'Unisex',
      },
      tags: ['trail', 'deportivo', 'senderismo'],
      metadata: { collection: 'Trail' },
    },
  ];

const watchFaqs = [
    {
      question: '¿Hacen envíos?',
      answer: 'Sí, realizamos envíos nacionales y entregas a nivel nacional.',
      keywords: ['envio', 'envios', 'domicilio', 'domicilios', 'entrega', 'entregas'],
      category: 'shipping',
      active: true,
    },
    {
      question: '¿Aceptan financiación?',
      answer: 'Sí, tenemos financiación para compras seleccionadas con condiciones especiales.',
      keywords: ['financiacion', 'financiamiento', 'cuotas', 'credito'],
      category: 'payments',
      active: true,
    },
    {
      question: '¿Cuánto tarda la entrega?',
      answer: 'Las entregas suelen tardar entre 2 y 5 días hábiles según la ciudad.',
      keywords: ['tiempo', 'entrega', 'tarda', 'dias', 'horario'],
      category: 'shipping',
      active: true,
    },
    {
      question: '¿Ofrecen garantía?',
      answer: 'Sí, todos nuestros relojes tienen garantía de 12 meses contra defectos de fabricación.',
      keywords: ['garantia', 'seguro', 'cobertura', 'defecto'],
      category: 'support',
      active: true,
    },
    {
      question: '¿Tienen reloj para hombre?',
      answer: 'Sí, contamos con modelos para hombre, mujer y unisex en múltiples estilos.',
      keywords: ['hombre', 'mujer', 'unisex', 'genero'],
      category: 'catalog',
      active: true,
    },
  ];

const baseBot = {
  escalation: { onRequest: true, onComplaint: true, afterUnknownAnswers: 2 },
  forbiddenTopics: ['política', 'religión', 'temas médicos', 'asesoría legal'],
};

const templates = [
  {
    code: 'generico',
    name: 'Comercio general',
    description: 'Punto de partida neutro para cualquier negocio.',
    isDefault: true,
    config: {
      branding: { primaryColor: '#111827', secondaryColor: '#f59e0b' },
      settings: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota', orderPrefix: 'PED' },
      chatSettings: {
        assistantName: 'Asistente',
        tone: 'cercano',
        welcomeMessage: '¡Hola! Soy el asistente virtual. Puedo ayudarte con productos, precios, envíos y horarios.',
        quickReplies: ['Ver productos', 'Horarios y ubicación', 'Medios de pago', 'Hablar con una persona'],
      },
      botSettings: { ...baseBot, personality: 'Eres amable, claro y breve. Respondes solo con información del negocio.' },
      storefront: { heroTitle: 'Bienvenido a nuestra tienda', heroSubtitle: 'Explora el catálogo y pregúntale al asistente lo que necesites.' },
    },
    content: { faqs: [
      { question: '¿Cuáles son los horarios de atención?', answer: 'Atendemos de lunes a sábado. Consulta los horarios exactos en la sección de sedes.', keywords: ['horario', 'horarios', 'atencion'] },
      { question: '¿Qué medios de pago aceptan?', answer: 'Aceptamos transferencia bancaria. Los datos aparecen al crear tu pedido.', keywords: ['pago', 'pagos', 'transferencia'] },
    ] },
  },
  {
    code: 'relojeria',
    name: 'Relojería y joyería',
    description: 'Relojes, joyas y accesorios premium.',
    isDefault: false,
    config: {
      branding: { primaryColor: '#1d2923', secondaryColor: '#a88d5c', fontFamily: 'serif' },
      settings: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota', orderPrefix: 'REL' },
      chatSettings: {
        assistantName: 'Asesor de relojería',
        tone: 'experto',
        welcomeMessage: '¡Hola! Puedo ayudarte a elegir un reloj o resolver dudas sobre garantía, envíos y pagos.',
        quickReplies: ['Recomiéndame un reloj', 'Garantía', 'Envíos', 'Medios de pago'],
      },
      botSettings: {
        ...baseBot,
        personality: 'Eres un asesor experto en relojería: preciso, elegante y sin exagerar. Cuando recomiendes, pregunta uso (diario, deportivo, formal) y presupuesto.',
        examples: [
          { question: '¿Tienen relojes para bucear?', answer: 'Sí. Para buceo te recomiendo modelos con al menos 200 m de resistencia al agua. ¿Prefieres automático o cuarzo?' },
        ],
      },
      storefront: {
        announcement: 'Envío asegurado en Colombia · 12 meses de garantía',
        heroKicker: 'Hechos para acompañar tu tiempo',
        heroTitle: 'Cada segundo, a tu manera.',
        heroSubtitle: 'Relojería con carácter para los días que se convierten en historia.',
        heroImageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1900&q=90',
        benefits: [
          { title: 'Diseño con intención', body: 'Piezas que equilibran precisión y personalidad.' },
          { title: '12 meses de garantía', body: 'Acompañamiento experto después de tu compra.' },
          { title: 'Envío asegurado', body: 'Recibe tu pedido donde estés en Colombia.' },
        ],
        helpTitle: '¿Buscas algo especial?',
        helpBody: 'Te ayudamos a encontrar el reloj perfecto para tu ocasión.',
      },
    },
    content: { categories: watchCategories, products: watchProducts, faqs: watchFaqs },
  },
  {
    code: 'moda',
    name: 'Moda y calzado',
    description: 'Ropa, calzado y accesorios con tallas y colores.',
    isDefault: false,
    config: {
      branding: { primaryColor: '#0f172a', secondaryColor: '#e11d48', fontFamily: 'rounded' },
      settings: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota', orderPrefix: 'MOD' },
      chatSettings: {
        assistantName: 'Asesor de estilo',
        tone: 'juvenil',
        welcomeMessage: '¡Hey! ¿Buscas algo en especial? Te ayudo con tallas, colores, envíos y cambios.',
        quickReplies: ['Guía de tallas', 'Cambios y devoluciones', 'Envíos', 'Hablar con una persona'],
      },
      botSettings: { ...baseBot, personality: 'Eres cercano y entusiasta, hablas de tú. Siempre confirma talla y color antes de recomendar.' },
      storefront: { heroTitle: 'Tu estilo, sin complicaciones', heroSubtitle: 'Encuentra tu talla y recibe en casa.' },
    },
    content: {
      categories: [
        { name: 'Camisetas', slug: 'camisetas', sortOrder: 1 },
        { name: 'Calzado', slug: 'calzado', sortOrder: 2 },
      ],
      products: [
        { name: 'Camiseta básica algodón', slug: 'camiseta-basica', categorySlug: 'camisetas', priceCents: 5990000, currency: 'COP', shortDescription: 'Algodón 100 %, corte regular.', attributes: { material: 'Algodón', tallas: 'S, M, L, XL' }, tags: ['camiseta', 'basica', 'algodon'], stock: 40, trackStock: true, type: 'PRODUCT' as const },
        { name: 'Tenis urbanos', slug: 'tenis-urbanos', categorySlug: 'calzado', priceCents: 18990000, currency: 'COP', shortDescription: 'Suela ligera, uso diario.', attributes: { material: 'Textil y sintético', tallas: '36 a 44' }, tags: ['tenis', 'zapatillas', 'urbano'], stock: 25, trackStock: true, type: 'PRODUCT' as const },
      ],
      faqs: [
        { question: '¿Cómo sé mi talla?', answer: 'Consulta la guía de tallas de cada producto. Si estás entre dos tallas, te recomendamos la mayor.', keywords: ['talla', 'tallas', 'medida'] },
        { question: '¿Puedo cambiar una prenda?', answer: 'Sí, tienes 30 días para cambios por talla o color con la prenda sin uso y con etiquetas.', keywords: ['cambio', 'cambios', 'devolucion'] },
      ],
    },
  },
  {
    code: 'restaurante',
    name: 'Restaurante y comida',
    description: 'Menú, domicilios, reservas y horarios.',
    isDefault: false,
    config: {
      branding: { primaryColor: '#7c2d12', secondaryColor: '#f59e0b', fontFamily: 'rounded' },
      settings: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota', orderPrefix: 'MESA' },
      chatSettings: {
        assistantName: 'Asistente del restaurante',
        tone: 'cercano',
        welcomeMessage: '¡Hola! ¿Quieres ver el menú, pedir a domicilio o reservar una mesa?',
        quickReplies: ['Ver menú', 'Domicilios', 'Horarios', 'Reservar'],
      },
      botSettings: { ...baseBot, personality: 'Eres cálido y ágil. Para domicilios confirma dirección y zona de cobertura antes de prometer tiempos.' },
      storefront: { heroTitle: 'Sabor que llega a tu mesa', heroSubtitle: 'Pide a domicilio o reserva en segundos.' },
    },
    content: {
      categories: [
        { name: 'Platos fuertes', slug: 'platos-fuertes', sortOrder: 1 },
        { name: 'Bebidas', slug: 'bebidas', sortOrder: 2 },
      ],
      products: [
        { name: 'Bandeja paisa', slug: 'bandeja-paisa', categorySlug: 'platos-fuertes', priceCents: 3200000, currency: 'COP', shortDescription: 'Plato típico completo.', tags: ['almuerzo', 'tipico'], type: 'PRODUCT' as const },
        { name: 'Limonada de coco', slug: 'limonada-coco', categorySlug: 'bebidas', priceCents: 900000, currency: 'COP', shortDescription: 'Bebida fría.', tags: ['bebida', 'limonada'], type: 'PRODUCT' as const },
      ],
      faqs: [
        { question: '¿Hacen domicilios?', answer: 'Sí, en las zonas de cobertura configuradas. El costo depende de la zona.', keywords: ['domicilio', 'domicilios', 'delivery'] },
        { question: '¿Puedo reservar?', answer: 'Sí, déjanos nombre, teléfono, fecha y número de personas y confirmamos la reserva.', keywords: ['reserva', 'reservar', 'mesa'] },
      ],
    },
  },
];

async function seedPlatform() {
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { code: plan.code }, create: plan, update: { name: plan.name, limits: plan.limits, features: plan.features } });
  }
  for (const template of templates) {
    await prisma.industryTemplate.upsert({
      where: { code: template.code },
      create: template,
      update: { name: template.name, description: template.description, isDefault: template.isDefault, config: template.config, content: template.content },
    });
  }
}

async function seedDemoTenant() {
  // Idempotente: elimina el tenant demo (cascada) y lo vuelve a crear desde la plantilla "relojeria".
  await prisma.tenant.deleteMany({ where: { slug: TENANT_SLUG } });
  const template = await prisma.industryTemplate.findUniqueOrThrow({ where: { code: 'relojeria' } });
  const config = template.config as Record<string, object>;

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Chronos Watches',
      slug: TENANT_SLUG,
      description: 'Tienda demo de relojes premium.',
      phone: '+57 300 123 4567',
      whatsappNumber: '+573001234567',
      email: 'hola@chronoswatches.com',
      address: { country: 'Colombia', city: 'Bogotá', street: 'Cra 7 # 20-10' },
      templateId: template.id,
      branding: config.branding,
      settings: config.settings,
      chatSettings: config.chatSettings,
      botSettings: config.botSettings,
      storefront: config.storefront,
      plan: 'PRO',
      paymentSettings: {
        bankTransferEnabled: true,
        bankName: 'Bancolombia',
        accountType: 'SAVINGS',
        accountNumber: '12345678901',
        accountHolder: 'Chronos Watches SAS',
        instructions: 'Envía el comprobante por el chat indicando tu número de pedido.',
      },
    },
  });

  await prisma.user.create({
    data: { tenantId: tenant.id, name: 'Admin Chronos', email: ADMIN_EMAIL, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'OWNER' },
  });

  const categoryIds = new Map<string, string>();
  for (const category of watchCategories) {
    const created = await prisma.category.create({ data: { ...category, tenantId: tenant.id } });
    categoryIds.set(category.slug, created.id);
  }
  for (const { categorySlug, ...product } of watchProducts) {
    await prisma.product.create({ data: { ...product, tenantId: tenant.id, categoryId: categoryIds.get(categorySlug) } });
  }
  await prisma.faq.createMany({ data: watchFaqs.map((faq, sortOrder) => ({ ...faq, sortOrder, tenantId: tenant.id })) });

  await prisma.widgetKey.create({
    data: { tenantId: tenant.id, key: 'wk_demo_chronos', name: 'Demo local', allowedDomains: ['localhost', '127.0.0.1'] },
  });

  return tenant;
}

async function main() {
  await seedPlatform();
  const tenant = await seedDemoTenant();
  console.log('Seed ejecutado con éxito');
  console.log('Planes y plantillas:', plans.length, '/', templates.length);
  console.log('Tenant:', tenant.slug, '· Widget key: wk_demo_chronos');
  console.log('Usuario:', ADMIN_EMAIL, '· Password:', ADMIN_PASSWORD);
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
