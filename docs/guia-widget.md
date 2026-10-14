# Guía de instalación del widget

El widget de SmartCommerce se instala con **una línea de script** en cualquier sitio web. Funciona en
HTML puro, WordPress, Shopify, Wix, Webflow y cualquier CMS que permita insertar HTML.

## 1. Obtén tu clave de widget

En el panel → **Configuración → Widget** (API: `POST /tenants/me/widget-keys`) crea una clave indicando
los dominios donde se usará, por ejemplo `mitienda.com` y `www.mitienda.com`. La clave tiene la forma
`wk_xxxxxxxx`. Es pública por diseño (viaja en el navegador); la seguridad se apoya en la lista de
dominios permitidos, el rate limiting y los límites de tu plan.

## 2. Pega el script

```html
<script src="https://TU-API/widget-assets/embed.js" data-key="wk_xxxxxxxx" async></script>
```

Colócalo antes de `</body>` (o en el `<head>` con `async`, como está). Eso es todo.

### Atributos opcionales

| Atributo | Descripción | Ejemplo |
|---|---|---|
| `data-position` | Lado de la burbuja (`right` por defecto) | `data-position="left"` |
| `data-color` | Color de la burbuja antes de cargar la configuración del comercio | `data-color="#1d2923"` |
| `data-open` | Abre el chat al cargar | `data-open="true"` |
| `data-api` | URL de la API si los assets se sirven desde un CDN distinto | `data-api="https://api.tu-dominio.com"` |
| `data-widget` | URL alternativa de `widget.html` | — |

### API JavaScript

```js
window.SmartCommerceWidget.open();
window.SmartCommerceWidget.close();
window.SmartCommerceWidget.toggle();
```

Útil para botones del tipo "¿Tienes dudas? Chatea con nosotros".

## 3. Instalación por plataforma

- **WordPress**: Apariencia → Editor de temas → `footer.php`, o un plugin tipo *Insert Headers and Footers*.
  Pega el script en el pie de página.
- **Shopify**: Tienda online → Temas → Editar código → `theme.liquid`, antes de `</body>`.
- **Wix**: Configuración → Código personalizado → Añadir código → pegar en *Body - end*, todas las páginas.
- **Webflow**: Project settings → Custom code → Footer code.
- **HTML puro**: pega la línea antes de `</body>`.

## 4. Qué carga en la página del comercio

- `embed.js` (~1,6 KB gzip): pinta la burbuja y crea un `iframe` aislado solo cuando hace falta
  (precarga en tiempo ocioso). No inyecta CSS global ni toca el DOM del sitio más allá de la burbuja.
- `widget.html` + `widget.js` + `widget.css` (~10,5 KB gzip en total) dentro del iframe. El CSS del
  sitio no afecta al chat y viceversa.

## 5. Comportamiento

- **Historial**: el visitante conserva su conversación entre páginas y recargas (identificador anónimo
  en `localStorage` del iframe).
- **Tiempo real**: respuestas por SSE con reconexión automática y recuperación de mensajes perdidos.
- **Accesibilidad**: navegación por teclado, `aria-live` en mensajes, foco gestionado, contraste AA,
  respeta `prefers-reduced-motion` y `prefers-color-scheme` (modo claro/oscuro automático).
- **Móvil**: en pantallas pequeñas el chat ocupa toda la pantalla.
- **Escalamiento**: botón "Hablar con una persona" y, si el comercio tiene número, "Seguir por WhatsApp".

## 6. Probar en local

```bash
npm run build:widget            # genera packages/widget/dist
npm run dev                     # la API sirve los assets en http://localhost:3001/widget-assets/
```

Página de prueba mínima (sirve con cualquier servidor estático, p. ej. `python3 -m http.server 8088`):

```html
<!doctype html><html><body>
<h1>Mi tienda</h1>
<script src="http://localhost:3001/widget-assets/embed.js" data-key="wk_demo_chronos" async></script>
</body></html>
```

La clave `wk_demo_chronos` (seed) acepta `localhost` y `127.0.0.1`.

## 7. Producción

- Sirve `packages/widget/dist` desde la API (`WIDGET_ASSETS_DIR`) o súbelo a un CDN (Cloudflare,
  S3+CloudFront). Si usas CDN, añade `data-api` con la URL de la API.
- La API ya envía las cabeceras correctas para los assets del widget (`frame-ancestors *`, sin
  `X-Frame-Options`, sin `Origin-Agent-Cluster`) y CORS abierto solo en `/widget/*`.
- Versiona la URL del script (`embed.js?v=2`) si necesitas invalidar cachés.

## 8. Solución de problemas

| Síntoma | Causa probable |
|---|---|
| La burbuja aparece pero el chat está vacío | Revisa en la consola si `widget.html` responde 200 y si la clave es válida |
| `403 Dominio no autorizado` | Añade el dominio (sin `https://`) a la lista de la clave |
| `401 Clave de widget inválida` | Clave desactivada o mal copiada |
| No llegan respuestas en tiempo real | Un proxy corta conexiones largas: desactiva el buffering para `/widget/*/events` (la API ya envía `X-Accel-Buffering: no`) |
