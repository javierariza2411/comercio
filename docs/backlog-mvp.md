# SmartCommerce — Backlog MVP (historias de usuario)

> Entregable 3. Prioridad: **P0** imprescindible para vender, **P1** deseable en MVP, **P2** Fase 2+.
> Roles: *Comercio* (OWNER/ADMIN), *Agente*, *Visitante* (cliente final), *Operador* (SaaS).

## Épica 0 — Saneamiento y base técnica (Fase 0)

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| S-01 | Como *operador* quiero que ningún endpoint devuelva datos de otro tenant para garantizar aislamiento. | `GET /catalog/public/:slug` solo devuelve productos de ese slug. No existe endpoint que liste tenants. Toda consulta de negocio filtra por `tenantId` del token. Test automatizado que lo verifica. | P0 |
| S-02 | Como *operador* quiero que el `tenantId` nunca se acepte desde el body. | Crear producto/categoría/FAQ con `tenantId` ajeno en el body devuelve 400 (`forbidNonWhitelisted`) y el recurso se crea en el tenant del token. | P0 |
| S-03 | Como *comercio* quiero registrarme e iniciar sesión de forma segura. | DTOs validados (email, contraseña ≥ 8). Access token 15 min, refresh 7 días rotativo, logout revoca. `JWT_SECRET` obligatorio (la API no arranca sin él en producción). 5 intentos/min por IP en `/auth/*`. | P0 |
| S-04 | Como *operador* quiero roles efectivos. | `AGENT` no puede cambiar configuración del tenant ni confirmar pagos (403). `OWNER`/`ADMIN` sí. | P0 |
| S-05 | Como *desarrollador* quiero levantar todo en local con un comando. | `docker compose up` levanta Postgres+pgvector, Redis y MinIO; `npm run dev` levanta API y web; `npm run db:migrate` y `npm run seed` funcionan. | P0 |
| S-06 | Como *desarrollador* quiero CI que bloquee regresiones. | GitHub Actions ejecuta lint, typecheck, tests unitarios y e2e con Postgres de servicio en cada PR. | P0 |
| S-07 | Como *visitante* quiero que mi pedido reserve stock. | Crear pedido decrementa stock en transacción; dos pedidos concurrentes no dejan stock negativo. | P1 |

## Épica A — Widget embebible

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| A-01 | Como *comercio* quiero instalar el chat pegando una línea de script. | El panel muestra `<script src=".../embed.js" data-key="wk_..."></script>`. Funciona en HTML puro, WordPress, Shopify y Wix (probado en HTML puro y WordPress; el resto documentado). | P0 |
| A-02 | Como *visitante* quiero una burbuja flotante y una ventana de chat moderna. | Burbuja con color del tenant; ventana responsive (móvil a pantalla completa); modo claro/oscuro automático y forzable; navegación por teclado; contraste AA; `aria-live` en mensajes. | P0 |
| A-03 | Como *visitante* quiero ver texto, imágenes, PDFs, botones rápidos y tarjetas de producto. | Cada tipo de `Message.type` se renderiza; PDF se abre en nueva pestaña con URL firmada; tarjetas con foto, precio y botones "Ver más / Cotizar / Comprar"; carrusel deslizable. | P0 |
| A-04 | Como *visitante* quiero no perder mi conversación al recargar. | `anonId` en `localStorage`; al recargar se cargan los últimos 50 mensajes. | P0 |
| A-05 | Como *visitante* quiero ver cuando el bot o agente escribe y que la conexión se recupere sola. | Indicador de escritura vía SSE; si cae la conexión se reconecta y recupera mensajes perdidos (`Last-Event-ID`). | P0 |
| A-06 | Como *comercio* quiero que el widget no afecte el rendimiento de mi web. | Loader ≤ 2 KB gz; bundle del iframe ≤ 50 KB gz; carga diferida al primer clic o tras 3 s; Lighthouse de la página host no baja más de 2 puntos. | P0 |
| A-07 | Como *operador* quiero que el widget solo funcione en dominios autorizados. | Peticiones con `Origin` fuera de la allowlist de la widget key reciben 403. | P0 |

## Épica B — Cerebro del chatbot

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| B-01 | Como *comercio* quiero que el bot responda solo con mi información. | Las respuestas citan internamente las fuentes (`meta.sources`). Pregunta sin contexto relevante → "No tengo esa información" + opciones humano/lead. Test con 20 preguntas de evaluación por plantilla: 0 alucinaciones de precio/política. | P0 |
| B-02 | Como *comercio* quiero cargar FAQ, políticas, horarios y documentos. | Alta de FAQ manual; subida de PDF, XLSX/CSV y texto; estado de ingesta visible (pendiente/listo/error); se puede probar una pregunta desde el panel. | P0 |
| B-03 | Como *visitante* quiero que el bot entienda qué quiero. | Clasificación de intención en ≥ 8 clases; `human` dispara handoff; `buy` muestra productos + botón; `lead` abre formulario. | P0 |
| B-04 | Como *comercio* quiero elegir el tono del bot. | Selector formal / cercano / juvenil + nombre del asistente + mensaje de bienvenida; se refleja en la respuesta. | P0 |
| B-05 | Como *operador* quiero controlar costos de IA. | Límite de mensajes IA por plan y por conversación; caché de respuestas; registro de tokens por mensaje; panel muestra consumo del mes. | P0 |
| B-06 | Como *operador* quiero cambiar de proveedor LLM sin tocar código. | `AI_PROVIDER=gemini|openai|anthropic` + override por tenant; mismos tests pasan con cada proveedor configurado. | P1 |
| B-07 | Como *comercio* quiero que el bot rechace temas ajenos y no filtre datos internos. | Prompt injection de prueba ("ignora tus instrucciones…") no cambia el comportamiento; preguntas fuera del negocio reciben redirección amable. | P0 |
| B-08 | Como *visitante* quiero un flujo guiado ("ayúdame a elegir"). | Flujo configurable de 2–4 preguntas con opciones que termina en recomendación de productos. | P1 |

## Épica C — Catálogo y archivos

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| C-01 | Como *comercio* quiero gestionar productos con fotos, precio, variantes y stock. | CRUD en panel; hasta 8 fotos por producto; variantes con precio/stock propio. | P0 |
| C-02 | Como *comercio* quiero importar mi catálogo desde Excel/CSV. | Plantilla descargable; vista previa con errores por fila; importación idempotente por `slug`/`sku`. | P0 |
| C-03 | Como *visitante* quiero ver productos como tarjetas en el chat. | El bot responde con tarjetas cuando la intención es producto/precio; botón "Cotizar" abre lead, "Comprar" abre pedido o link externo. | P0 |
| C-04 | Como *visitante* quiero pedir el catálogo en PDF o fotos. | "Envíame el catálogo" → PDF subido por el comercio o PDF autogenerado desde los productos (Fase 2); galería de imágenes en carrusel. | P0 / P2 |
| C-05 | Como *operador* quiero almacenamiento seguro. | Bucket privado, URLs firmadas 1 h, MIME verificado por magic bytes, límite de tamaño por plan, cuota de almacenamiento por tenant. | P0 |

## Épica D — Atención humana

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| D-01 | Como *agente* quiero una bandeja en tiempo real. | Lista con filtros (esperando / mías / cerradas), contador de no leídos, actualización por SSE sin recargar. | P0 |
| D-02 | Como *agente* quiero tomar una conversación con todo el contexto. | Al asignar, el bot deja de responder; veo historial completo, intención detectada y datos del lead. | P0 |
| D-03 | Como *agente* quiero notas internas, respuestas predefinidas, etiquetas y estados. | Notas no visibles al visitante; atajos `/envios` insertan respuesta; etiquetas libres; estados abierto/pendiente/cerrado. | P0 |
| D-04 | Como *comercio* quiero notificaciones de handoff. | Correo al equipo cuando una conversación pasa a "esperando agente"; push web (P1); WhatsApp (P2). | P0 / P1 / P2 |
| D-05 | Como *comercio* quiero horarios de atención. | Fuera de horario el bot informa y ofrece dejar datos; dentro de horario ofrece agente. | P0 |

## Épica E — Leads y ventas

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| E-01 | Como *visitante* quiero dejar mis datos con consentimiento explícito. | Formulario conversacional nombre/correo/teléfono; casilla de consentimiento con texto de política configurable; se guarda `consentAt`, `consentText`, IP. | P0 |
| E-02 | Como *comercio* quiero exportar leads. | CSV con filtros por fecha/estado; webhooks por evento `lead.created` (P1); Google Sheets vía Zapier/Make (P2). | P0 / P1 / P2 |
| E-03 | Como *visitante* quiero hacer un pedido simple por transferencia. | Flujo existente de pedido se conserva y se puede iniciar desde una tarjeta de producto. | P1 |
| E-04 | Como *visitante* quiero consultar el estado de mi pedido. | "¿Cómo va mi pedido SC-…?" → estado desde BD; API pública para integrar pedidos externos (P2). | P1 / P2 |

## Épica F — Parametrización multi-tenant

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| F-01 | Como *comercio* quiero configurar marca y apariencia sin código. | Logo, colores, tipografía (2–3 opciones), posición de la burbuja, mensaje de bienvenida; vista previa en vivo. | P0 |
| F-02 | Como *comercio* quiero reglas de escalamiento. | Configurar: escalar si el visitante lo pide, si el bot no sabe N veces, si la intención es reclamo. | P0 |
| F-03 | Como *comercio* quiero empezar con una plantilla de mi industria. | Al menos 3 plantillas (relojería, moda/calzado, restaurante) con FAQ, tono y productos de ejemplo; se aplican en un clic y se pueden borrar. | P0 |
| F-04 | Como *comercio* quiero que el sistema cree mi base de conocimiento desde mi web. | Pego la URL, se rastrean hasta N páginas del dominio y se generan fuentes; puedo revisar y borrar. | P2 |
| F-05 | Como *comercio* quiero invitar agentes. | Invitación por correo, rol AGENT, límite por plan. | P0 |

## Épica G — Analítica

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| G-01 | Como *comercio* quiero un tablero de resultados. | Conversaciones, % resueltas por bot, tiempo medio de respuesta, leads, productos más consultados, consumo IA. Rango de fechas. | P0 |
| G-02 | Como *comercio* quiero ver qué no supo responder el bot. | Lista de preguntas sin respuesta con botón "Crear FAQ" prellenado. | P0 |
| G-03 | Como *comercio* quiero medir satisfacción. | Encuesta CSAT (1–5) al cerrar conversación; promedio en tablero. | P1 |
| G-04 | Como *comercio* quiero sugerencias para mejorar la KB. | Agrupación de preguntas sin respuesta por similitud y sugerencia de FAQ. | P2 |

## Épica H — WhatsApp opcional (Fase 3)

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| H-01 | Como *visitante* quiero continuar por WhatsApp si lo pido. | Botón "Seguir por WhatsApp" con enlace `wa.me` prellenado (sin API, costo cero) en MVP; conector Cloud API en Fase 3. | P1 / P2 |
| H-02 | Como *comercio* quiero ver el costo estimado de WhatsApp. | Panel muestra conversaciones derivadas y costo estimado con tarifa configurable. | P2 |

## Épica I — Modelo comercial (Fase 2)

| ID | Historia | Criterios de aceptación | Pri |
|---|---|---|---|
| I-01 | Como *operador* quiero planes con límites. | Básico/Pro/Empresa con límites de conversaciones, agentes, almacenamiento y mensajes IA; bloqueo suave al superar (aviso) y duro al +20 %. | P0 (límites) / P2 (cobro) |
| I-02 | Como *comercio* quiero suscribirme y pagar en línea. | Checkout Wompi, prueba gratuita 14 días, webhooks de pago, facturas descargables. | P2 |
| I-03 | Como *revendedor* quiero marca blanca. | Dominio y logo propios en widget y panel; sub-tenants. | P2 |

## Orden de implementación propuesto para la Fase 1

1. Widget (A-01…A-07) con backend de chat mínimo (eco) → demo visible desde la semana 1.
2. Conocimiento + IA (B-01…B-05, B-07) → bot útil.
3. Catálogo + archivos (C-01…C-03, C-05).
4. Handoff (D-01…D-03, D-05) + leads (E-01).
5. Panel de parametrización (F-01, F-02, F-03, F-05) + analítica (G-01, G-02).
6. Límites por plan (I-01) y D-04 correo.
