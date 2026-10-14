/**
 * Loader de SmartCommerce. Se instala con una línea:
 *   <script src="https://cdn.tu-dominio.com/embed.js" data-key="wk_xxx" async></script>
 *
 * Atributos opcionales: data-api (URL de la API), data-widget (URL del widget.html),
 * data-position="left|right", data-color="#hex", data-open="true" (abre al cargar).
 *
 * Responsabilidad mínima: pintar la burbuja, crear el iframe aislado bajo demanda y
 * reenviar mensajes entre la página y el iframe. Toda la UI vive dentro del iframe.
 */
(() => {
  const script = (document.currentScript as HTMLScriptElement | null) ?? (Array.from(document.scripts).find((s) => s.dataset.key) as HTMLScriptElement | undefined);
  if (!script) return;
  const key = script.dataset.key;
  if (!key || (window as unknown as { __scWidget?: boolean }).__scWidget) return;
  (window as unknown as { __scWidget?: boolean }).__scWidget = true;

  const scriptUrl = new URL(script.src, location.href);
  const base = scriptUrl.href.replace(/embed\.js(\?.*)?$/, '');
  const widgetUrl = script.dataset.widget || `${base}widget.html`;
  const apiUrl = script.dataset.api || scriptUrl.origin;
  const position = script.dataset.position === 'left' ? 'left' : 'right';
  const color = script.dataset.color || '#111827';

  const style = document.createElement('style');
  style.textContent = `
    .sc-bubble{position:fixed;bottom:20px;${position}:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:${color};color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}
    .sc-bubble:hover{transform:scale(1.05)}
    .sc-bubble:focus-visible{outline:3px solid #fff;outline-offset:2px}
    .sc-bubble svg{width:26px;height:26px}
    .sc-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;border-radius:9px;background:#dc2626;color:#fff;font:600 11px/18px system-ui;text-align:center;padding:0 4px}
    .sc-frame{position:fixed;bottom:88px;${position}:20px;z-index:2147483000;width:min(400px,calc(100vw - 32px));height:min(640px,calc(100vh - 110px));border:0;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);background:#fff;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s;color-scheme:light dark}
    .sc-frame.sc-open{opacity:1;transform:none;pointer-events:auto}
    @media (max-width:480px){.sc-frame{bottom:0;${position}:0;width:100vw;height:100dvh;border-radius:0}}
    @media (prefers-reduced-motion:reduce){.sc-bubble,.sc-frame{transition:none}}
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('button');
  bubble.className = 'sc-bubble';
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Abrir chat de atención');
  bubble.setAttribute('aria-expanded', 'false');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>';
  document.body.appendChild(bubble);

  let frame: HTMLIFrameElement | null = null;
  let open = false;
  let unread = 0;
  const badge = document.createElement('span');
  badge.className = 'sc-badge';
  badge.hidden = true;
  bubble.appendChild(badge);

  const ensureFrame = () => {
    if (frame) return frame;
    frame = document.createElement('iframe');
    frame.className = 'sc-frame';
    frame.title = 'Chat de atención';
    frame.setAttribute('allow', 'clipboard-write');
    const params = new URLSearchParams({ key, api: apiUrl, host: location.origin, page: location.href, color });
    frame.src = `${widgetUrl}#${params.toString()}`;
    document.body.appendChild(frame);
    return frame;
  };

  const setOpen = (value: boolean) => {
    open = value;
    const f = ensureFrame();
    f.classList.toggle('sc-open', open);
    bubble.setAttribute('aria-expanded', String(open));
    bubble.setAttribute('aria-label', open ? 'Cerrar chat de atención' : 'Abrir chat de atención');
    if (open) {
      unread = 0;
      badge.hidden = true;
      f.contentWindow?.postMessage({ type: 'sc:open' }, '*');
      f.focus();
    }
  };

  bubble.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data as { type?: string; count?: number } | undefined;
    if (data?.type === 'sc:close') setOpen(false);
    if (data?.type === 'sc:unread' && !open) {
      unread = data.count ?? unread + 1;
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
    }
  });

  // API pública mínima para la página anfitriona.
  (window as unknown as { SmartCommerceWidget: unknown }).SmartCommerceWidget = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
  };
  if (script.dataset.open === 'true') setOpen(true);
  // Precarga diferida del iframe para que la primera apertura sea instantánea sin bloquear la página.
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => ensureFrame());
  else setTimeout(ensureFrame, 3000);
})();
