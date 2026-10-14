'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownWideNarrow, ArrowRight, Check, Heart, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import StoreChat from './store-chat';

import { formatMoney, type CreateOrderResponse, type PublicCatalog, type PublicProduct, type PublicTenant } from '@smartcommerce/shared';

type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  category: string;
  description: string;
  specs: string[];
  image: string;
  badge?: string;
  tags: string[];
};

type CartEntry = { product: Product; quantity: number };

// Imagen neutra de plataforma; cada tenant puede definir la suya en branding.placeholderImageUrl.
const PLATFORM_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#e7e5e4"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="#78716c" text-anchor="middle" dominant-baseline="middle">Sin imagen</text></svg>');
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function toViewModel(catalog: PublicCatalog, placeholder: string): Product[] {
  const categoryNames = new Map(catalog.categories.map((category) => [category.id, category.name]));
  return catalog.products.map((product: PublicProduct) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    currency: product.currency,
    category: (product.categoryId && categoryNames.get(product.categoryId)) || 'General',
    description: product.description || product.shortDescription,
    specs: Object.entries(product.attributes ?? {})
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
      .slice(0, 4)
      .map(([key, value]) => `${key.charAt(0).toUpperCase()}${key.slice(1)}: ${value}`),
    image: product.images[0] && /^https?:\/\//.test(product.images[0]) ? product.images[0] : placeholder,
    badge: product.featured ? 'Destacado' : undefined,
    tags: product.tags ?? [],
  }));
}

export default function Storefront({ businessSlug }: { businessSlug: string }) {
  const [category, setCategory] = useState('Todos');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', city: '', address: '' });
  const [orderResult, setOrderResult] = useState<CreateOrderResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${apiUrl}/tenants/public/${businessSlug}`),
      fetch(`${apiUrl}/catalog/public/${businessSlug}`),
    ])
      .then(async ([tenantResponse, catalogResponse]) => {
        if (tenantResponse.status === 404) return setLoadState('not-found');
        if (!tenantResponse.ok || !catalogResponse.ok) return setLoadState('error');
        const [tenantData, catalogData] = await Promise.all([tenantResponse.json(), catalogResponse.json()]);
        if (cancelled) return;
        setTenant(tenantData);
        setProducts(toViewModel(catalogData, tenantData?.branding?.placeholderImageUrl || PLATFORM_PLACEHOLDER));
        setLoadState('ready');
      })
      .catch(() => !cancelled && setLoadState('error'));
    return () => { cancelled = true; };
  }, [businessSlug]);

  const paymentSettings = tenant?.paymentSettings ?? null;
  const storeName = tenant?.name ?? 'Tienda';
  const currency = tenant?.settings?.currency ?? 'COP';
  const sf = tenant?.storefront ?? {};
  const brand = tenant?.branding ?? {};
  const themeVars = { '--brand': brand.primaryColor ?? '#111827', '--accent': brand.secondaryColor ?? '#f59e0b' } as React.CSSProperties;
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const cartTotal = cart.reduce((sum, entry) => sum + entry.product.priceCents * entry.quantity, 0);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((entry) => entry.product.slug === product.slug);
      if (existing) return current.map((entry) => entry.product.slug === product.slug ? { ...entry, quantity: entry.quantity + 1 } : entry);
      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(slug: string, delta: number) {
    setCart((current) => current
      .map((entry) => entry.product.slug === slug ? { ...entry, quantity: entry.quantity + delta } : entry)
      .filter((entry) => entry.quantity > 0));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingOrder(true);
    setCheckoutError('');
    try {
      const response = await fetch(`${apiUrl}/orders/${businessSlug}/bank-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buyer, email: buyer.email.trim() || undefined, items: cart.map(({ product, quantity }) => ({ productSlug: product.slug, quantity })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No pudimos crear el pedido. Verifica los datos e inténtalo otra vez.');
      setOrderResult(result);
      setCart([]);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'No pudimos conectar con la tienda. Inténtalo más tarde.');
    } finally {
      setSubmittingOrder(false);
    }
  }

  const visibleProducts = useMemo(() => {
    const matching = products.filter((product) => {
      const matchesCategory = category === 'Todos' || product.category === category;
      const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim());
      return matchesCategory && matchesQuery;
    });

    if (sort === 'price-asc') return [...matching].sort((first, second) => first.priceCents - second.priceCents);
    if (sort === 'price-desc') return [...matching].sort((first, second) => second.priceCents - first.priceCents);
    return matching;
  }, [products, category, query, sort]);

  function toggleFavorite(name: string) {
    setFavorites((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  if (loadState === 'loading') {
    return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] text-sm text-stone-500" aria-busy="true">Cargando tienda…</main>;
  }
  if (loadState === 'not-found') {
    return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-5 text-center"><div><h1 className="font-serif text-3xl text-[#1d2923]">Comercio no encontrado</h1><p className="mt-2 text-sm text-stone-500">Revisa la dirección o contacta al comercio.</p></div></main>;
  }
  if (loadState === 'error') {
    return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-5 text-center"><div><h1 className="font-serif text-3xl text-[#1d2923]">No pudimos cargar la tienda</h1><p className="mt-2 text-sm text-stone-500">Inténtalo de nuevo en unos minutos.</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] pb-20 text-[#1d2923]" style={themeVars}>
      {sf.announcement && <div className="bg-[var(--brand)] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">{sf.announcement}</div>}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f7f7f3]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label={`${storeName}, inicio`}>
            <span className="grid size-10 place-items-center rounded-full border border-[#a88d5c] font-serif text-lg text-[#a88d5c]">{storeName.charAt(0).toUpperCase()}</span>
            <span>
              <span className="block font-serif text-lg leading-tight">{storeName.toUpperCase()}</span>
              <span className="block text-[9px] font-medium uppercase text-stone-500">{tenant?.description ? tenant.description.slice(0, 40) : 'Tienda en línea'}</span>
            </span>
          </a>
          <nav aria-label="Navegación principal" className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
            <a href="#coleccion" className="transition hover:text-[#a88d5c]">Colección</a>
            <a href="#historia" className="transition hover:text-[#a88d5c]">Nuestra esencia</a>
            <a href="#servicio" className="transition hover:text-[#a88d5c]">Servicio</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="#coleccion" className="hidden items-center gap-2 text-sm font-semibold text-[#1d2923] transition hover:text-[#a88d5c] sm:flex">Explorar <ArrowRight size={16} /></a>
            <button onClick={() => { setCheckoutOpen(true); setOrderResult(null); }} aria-label={`Abrir bolsa, ${cart.reduce((sum, entry) => sum + entry.quantity, 0)} productos`} className="relative grid size-11 place-items-center border border-stone-300 transition hover:border-[#1d2923]">
              <ShoppingBag size={19} />
              {cart.length > 0 && <span className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-[#a33c2f] text-[10px] font-semibold text-white">{cart.reduce((sum, entry) => sum + entry.quantity, 0)}</span>}
            </button>
          </div>
        </div>
      </header>

      <section id="inicio" className="relative isolate overflow-hidden bg-[#18251e] text-white">
        <div className="absolute inset-0 -z-20 bg-[#18251e]" />
        <div className="absolute inset-y-0 right-0 -z-10 w-full md:w-[64%]">
          <Image
            src={sf.heroImageUrl || PLATFORM_PLACEHOLDER}
            alt={`Portada de ${storeName}`}
            fill
            priority
            unoptimized
            className="object-cover object-center opacity-65 md:opacity-80"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#18251e] via-[#18251e]/75 to-[#18251e]/10 md:from-[#18251e] md:via-[#18251e]/55 md:to-transparent" />
        </div>
        <div className="mx-auto flex min-h-[470px] max-w-7xl items-center px-5 py-16 sm:px-8 md:min-h-[520px]">
          <div className="max-w-xl">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase text-[#d5bd8d]">
              <span className="h-px w-8 bg-[var(--accent)]" /> {sf.heroKicker || storeName}
            </p>
            <h1 className="mt-6 font-serif text-5xl leading-[1.04] sm:text-6xl">{sf.heroTitle || `Bienvenido a ${storeName}`}</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-stone-200">{sf.heroSubtitle || tenant?.description || 'Resuelve tus dudas y compra con confianza desde nuestra tienda.'}</p>
            <a href="#coleccion" className="mt-8 inline-flex items-center gap-3 border border-[#d5bd8d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d5bd8d] hover:text-[#18251e]">
              Descubrir colección <ArrowRight size={16} />
            </a>
            <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="ml-3 mt-3 inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-white transition hover:text-[#d5bd8d]">
              Resolver dudas antes de comprar <ArrowRight size={16} />
            </button>
          </div>
        </div>
        
      </section>

      <section id="historia" className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:grid-cols-3 sm:px-8">
        {(sf.benefits ?? []).map((item, index) => (
          <div key={item.title} className={`border-l-2 pl-4 ${index === 1 ? 'border-[#a88d5c]' : 'border-[#53695b]'}`}>
            <h2 className="font-serif text-lg">{item.title}</h2>
            <p className="mt-1 text-sm text-stone-500">{item.body}</p>
          </div>
        ))}
      </section>

      <section id="coleccion" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 pt-7 sm:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-stone-300 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-[#92784e]">Catálogo de {storeName}</p>
            <h2 className="mt-2 font-serif text-4xl sm:text-5xl">La colección</h2>
            <p className="mt-2 text-sm text-stone-500">Encuentra la pieza que acompaña tu ritmo.</p>
          </div>
          <p className="text-sm text-stone-500">{visibleProducts.length} modelos disponibles</p>
        </div>

        <div className="sticky top-[72px] z-20 -mx-5 border-b border-stone-200 bg-[#f7f7f3]/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por estilo">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 border px-4 py-2 text-sm transition ${category === item ? 'border-[#1d2923] bg-[#1d2923] text-white' : 'border-stone-300 bg-transparent text-stone-600 hover:border-stone-500'}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex min-w-0 items-center gap-2 border border-stone-300 bg-white px-3 sm:w-60">
                <Search size={16} className="shrink-0 text-stone-400" />
                <input aria-label="Buscar productos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo o estilo" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-stone-400" />
                {query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={15} className="text-stone-400" /></button>}
              </label>
              <label className="flex items-center gap-2 border border-stone-300 bg-white px-3">
                <ArrowDownWideNarrow size={16} className="shrink-0 text-stone-500" />
                <span className="sr-only">Ordenar productos</span>
                <select aria-label="Ordenar productos" value={sort} onChange={(event) => setSort(event.target.value)} className="w-full bg-transparent py-2.5 text-sm text-stone-700 outline-none sm:w-auto">
                  <option value="featured">Destacados</option>
                  <option value="price-asc">Precio: menor a mayor</option>
                  <option value="price-desc">Precio: mayor a menor</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {visibleProducts.length ? (
          <div className="grid gap-x-5 gap-y-9 pt-7 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product, index) => {
              const isFavorite = favorites.includes(product.name);
              return (
                <article key={product.name} className="group min-w-0 animate-[rise-in_450ms_ease_both]" style={{ animationDelay: `${index * 60}ms` }}>
                  <div className="relative aspect-[4/4.2] overflow-hidden bg-[#eae8e1]">
                    <Image src={product.image} alt={product.name} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
                    <span className="absolute left-3 top-3 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-stone-700">{product.badge ?? product.category}</span>
                    <button onClick={() => toggleFavorite(product.name)} aria-label={isFavorite ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`} aria-pressed={isFavorite} className={`absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 transition hover:bg-white ${isFavorite ? 'text-rose-600' : 'text-stone-600'}`}>
                      <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => setSelectedProduct(product)} className="absolute inset-x-3 bottom-3 translate-y-2 bg-white px-4 py-3 text-sm font-semibold text-[#1d2923] opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100">
                      Vista rápida <ArrowRight size={15} className="ml-2 inline" />
                    </button>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-4">
                    <div>
                      <p className="text-xs text-stone-500">{product.category}</p>
                      <h3 className="mt-1 font-serif text-2xl">{product.name}</h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatMoney(product.priceCents, product.currency)}</p>
                      {product.compareAtPriceCents ? <p className="mt-0.5 text-xs text-stone-400 line-through">{formatMoney(product.compareAtPriceCents, product.currency)}</p> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setSelectedProduct(product)} className="flex-1 border border-[#1d2923] px-3 py-2.5 text-sm font-semibold transition hover:bg-[#1d2923] hover:text-white">Ver detalles</button>
                    <button onClick={() => addToCart(product)} aria-label={`Agregar ${product.name} a la bolsa`} className="grid size-11 place-items-center bg-[#1d2923] text-white transition hover:bg-[#34473c]"><ShoppingBag size={17} /></button>
                    <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="grid size-11 place-items-center border border-stone-300 text-[#1d2923] transition hover:border-[#1d2923]" aria-label={`Preguntar al asistente sobre ${product.name}`}>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center">
            <SlidersHorizontal className="mx-auto text-stone-400" size={24} />
            <p className="mt-4 font-serif text-2xl">No encontramos ese modelo</p>
            <p className="mt-2 text-sm text-stone-500">Prueba otra búsqueda o cambia el estilo seleccionado.</p>
            <button onClick={() => { setQuery(''); setCategory('Todos'); }} className="mt-5 border border-[#1d2923] px-4 py-2 text-sm font-semibold hover:bg-[#1d2923] hover:text-white">Ver toda la colección</button>
          </div>
        )}
      </section>

      <section id="servicio" className="bg-[#e9e8df]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[#92784e]">Asistente</p>
            <h2 className="mt-2 font-serif text-3xl">{sf.helpTitle || '¿Tienes dudas?'}</h2>
            <p className="mt-2 text-sm text-stone-600">{sf.helpBody || 'Pregúntale a nuestro asistente antes de comprar.'}</p>
          </div>
          <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="inline-flex items-center justify-center gap-2 self-start border border-[#1d2923] px-5 py-3 text-sm font-semibold transition hover:bg-[#1d2923] hover:text-white md:self-auto">Resolver mis dudas <ArrowRight size={16} /></button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-serif text-sm text-[#1d2923]">{storeName.toUpperCase()}</p>
        <p>© {new Date().getFullYear()} {storeName}</p>
      </footer>

      {selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#101812]/65 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="quick-view-title" className="relative grid max-h-[92dvh] w-full max-w-4xl grid-cols-1 overflow-y-auto bg-[#f7f7f3] sm:grid-cols-2">
            <button onClick={() => setSelectedProduct(null)} aria-label="Cerrar detalles" className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-stone-700"><X size={19} /></button>
            <div className="relative min-h-64 bg-[#eae8e1] sm:min-h-[520px]">
              <Image src={selectedProduct.image} alt={selectedProduct.name} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="text-xs font-semibold uppercase text-[#92784e]">{selectedProduct.category}</p>
              <h2 id="quick-view-title" className="mt-2 font-serif text-4xl">{selectedProduct.name}</h2>
              <p className="mt-4 text-2xl font-semibold">{formatMoney(selectedProduct.priceCents, selectedProduct.currency)} {selectedProduct.compareAtPriceCents ? <span className="ml-2 text-base font-normal text-stone-400 line-through">{formatMoney(selectedProduct.compareAtPriceCents, selectedProduct.currency)}</span> : null}</p>
              <p className="mt-5 text-sm leading-6 text-stone-600">{selectedProduct.description}</p>
              <ul className="mt-6 space-y-3 border-y border-stone-300 py-5">
                {selectedProduct.specs.map((spec) => <li key={spec} className="flex items-center gap-2 text-sm text-stone-700"><Check size={15} className="text-[#75866f]" /> {spec}</li>)}
              </ul>
              <button onClick={() => { setSelectedProduct(null); window.dispatchEvent(new Event('open-store-assistant')); }} className="mt-6 flex items-center justify-center gap-2 bg-[#1d2923] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#354b3e]">Preguntar al asistente <ArrowRight size={16} /></button>
              <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setCheckoutOpen(true); }} className="mt-2 flex items-center justify-center gap-2 border border-[#1d2923] px-5 py-3.5 text-sm font-semibold transition hover:bg-[#1d2923] hover:text-white"><ShoppingBag size={16} /> Agregar a la bolsa</button>
              <p className="mt-3 text-center text-xs text-stone-500">{sf.announcement || ''}</p>
            </div>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#101812]/65 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="checkout-title" className="relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto bg-[#f7f7f3] p-5 sm:p-8">
            <button onClick={() => setCheckoutOpen(false)} aria-label="Cerrar bolsa" className="absolute right-3 top-3 grid size-10 place-items-center text-stone-600"><X size={19} /></button>
            <p className="text-xs font-semibold uppercase text-[#92784e]">Compra directa</p>
            <h2 id="checkout-title" className="mt-2 font-serif text-3xl">{orderResult ? 'Pedido creado' : 'Tu bolsa'}</h2>

            {orderResult ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-stone-600">Pedido <strong className="text-stone-900">{orderResult.orderNumber}</strong> · Total <strong className="text-stone-900">{formatMoney(orderResult.totalCents, orderResult.currency)}</strong></p>
                <div className="border border-stone-300 bg-white p-5">
                  <h3 className="font-semibold">Transfiere a esta cuenta</h3>
                  <p className="mt-3 text-sm text-stone-600">{orderResult.bankTransfer.bankName} · {orderResult.bankTransfer.accountType === 'SAVINGS' ? 'Ahorros' : 'Corriente'}</p>
                  <p className="mt-1 text-lg font-semibold text-stone-900">{orderResult.bankTransfer.accountNumber}</p>
                  <p className="mt-1 text-sm text-stone-600">Titular: {orderResult.bankTransfer.accountHolder}</p>
                  {orderResult.bankTransfer.instructions && <p className="mt-3 text-sm text-stone-600">{orderResult.bankTransfer.instructions}</p>}
                </div>
                <p className="text-sm leading-6 text-stone-600">El pedido queda pendiente hasta que el comercio verifique la transferencia. No envíes dinero a cuentas distintas a la indicada aquí.</p>
                <button onClick={() => setCheckoutOpen(false)} className="w-full bg-[#1d2923] px-4 py-3 text-sm font-semibold text-white">Entendido</button>
              </div>
            ) : (
              <>
                {cart.length ? <div className="mt-5 divide-y divide-stone-300 border-y border-stone-300">
                  {cart.map(({ product, quantity }) => <div key={product.slug} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-stone-500">{formatMoney(product.priceCents, product.currency)} c/u</p></div>
                    <div className="flex items-center gap-2"><button onClick={() => changeQuantity(product.slug, -1)} aria-label={`Quitar una unidad de ${product.name}`} className="grid size-8 place-items-center border border-stone-300"><Minus size={14} /></button><span className="w-5 text-center text-sm">{quantity}</span><button onClick={() => changeQuantity(product.slug, 1)} aria-label={`Agregar una unidad de ${product.name}`} className="grid size-8 place-items-center border border-stone-300"><Plus size={14} /></button></div>
                  </div>)}
                </div> : <p className="mt-5 text-sm text-stone-500">Tu bolsa está vacía. Agrega un modelo de la colección para continuar.</p>}
                <p className="mt-4 flex justify-between text-base font-semibold"><span>Total</span><span>{formatMoney(cartTotal, currency)}</span></p>
                {!paymentSettings?.bankTransferEnabled && <p className="mt-4 border-l-2 border-[#a33c2f] bg-white px-4 py-3 text-sm leading-6 text-stone-600">El comercio aún no ha configurado una cuenta para transferencias. No podemos recibir pedidos pagados hasta que el vendedor complete esa configuración.</p>}
                <form onSubmit={submitOrder} className="mt-5 grid gap-3 sm:grid-cols-2">
                  <input required minLength={2} maxLength={120} value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} placeholder="Nombre completo" aria-label="Nombre completo" className="border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                  <input required type="tel" minLength={7} maxLength={30} value={buyer.phone} onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })} placeholder="Teléfono" aria-label="Teléfono" className="border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                  <input type="email" value={buyer.email} onChange={(event) => setBuyer({ ...buyer, email: event.target.value })} placeholder="Correo (opcional)" aria-label="Correo opcional" className="border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                  <input required minLength={2} maxLength={100} value={buyer.city} onChange={(event) => setBuyer({ ...buyer, city: event.target.value })} placeholder="Ciudad" aria-label="Ciudad" className="border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                  <input required minLength={5} maxLength={240} value={buyer.address} onChange={(event) => setBuyer({ ...buyer, address: event.target.value })} placeholder="Dirección de entrega" aria-label="Dirección de entrega" className="border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b] sm:col-span-2" />
                  {checkoutError && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{checkoutError}</p>}
                  <button disabled={!cart.length || !paymentSettings?.bankTransferEnabled || submittingOrder} className="flex items-center justify-center gap-2 bg-[#1d2923] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#354b3e] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2">
                    <ShoppingBag size={16} /> {submittingOrder ? 'Creando pedido...' : 'Crear pedido por transferencia'}
                  </button>
                  <p className="text-center text-xs text-stone-500 sm:col-span-2">Transferencia directa al comercio · Confirmación manual · Sin comisión de pasarela</p>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      <StoreChat
        businessSlug={businessSlug}
        storeName={storeName}
        assistantName={tenant?.chatSettings?.assistantName}
        welcomeMessage={tenant?.chatSettings?.welcomeMessage}
        whatsappNumber={tenant?.whatsappNumber}
        products={products}
      />
    </main>
  );
}