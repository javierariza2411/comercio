'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowRight, Check, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import StoreChat from './store-chat';

type Product = {
  name: string;
  price: number;
  oldPrice: number;
  category: string;
  description: string;
  specs: string[];
  image: string;
  badge?: string;
};

const products: Product[] = [
  {
    name: 'Automatic Classic', price: 649900, oldPrice: 749900, category: 'Automáticos',
    description: 'Una pieza de inspiración clásica con movimiento automático y acabados pensados para acompañarte durante años.',
    specs: ['Movimiento automático', 'Acero inoxidable', 'Resistencia al agua 100 m'],
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85', badge: 'Más elegido',
  },
  {
    name: 'Diver Pro', price: 799900, oldPrice: 929900, category: 'Deportivos',
    description: 'Preparado para salir de la rutina: una silueta robusta, lectura clara y resistencia para tus planes al aire libre.',
    specs: ['Movimiento automático', 'Caja de titanio', 'Resistencia al agua 300 m'],
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85', badge: 'Edición aventura',
  },
  {
    name: 'Urban 38', price: 529900, oldPrice: 619900, category: 'Diarios',
    description: 'Diseño limpio y ligero para llevar del trabajo al fin de semana sin cambiar de ritmo.',
    specs: ['Movimiento de cuarzo', 'Acero inoxidable', 'Resistencia al agua 50 m'],
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1000&q=85',
  },
  {
    name: 'Sport X', price: 689900, oldPrice: 769900, category: 'Deportivos',
    description: 'Una silueta dinámica, cómoda y resistente para quienes prefieren tener el día en movimiento.',
    specs: ['Movimiento de cuarzo', 'Caja de aluminio', 'Resistencia al agua 100 m'],
    image: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=1000&q=85',
  },
  {
    name: 'Elegance', price: 899900, oldPrice: 1049900, category: 'Elegantes',
    description: 'Proporciones refinadas y detalles delicados para celebraciones y momentos que merecen quedarse.',
    specs: ['Movimiento automático', 'Acabado oro blanco', 'Resistencia al agua 50 m'],
    image: 'https://images.unsplash.com/photo-1508685096489-7c7d2c7e3c4f?auto=format&fit=crop&w=1000&q=85', badge: 'Nuevo',
  },
  {
    name: 'Smart One', price: 1099900, oldPrice: 1269900, category: 'Smartwatch',
    description: 'Conectividad y seguimiento diario en una pieza que mantiene el lenguaje visual de Chronos.',
    specs: ['Pantalla digital', 'Seguimiento diario', 'Resistencia al agua 50 m'],
    image: 'https://images.unsplash.com/photo-1544117519-31a4b719223d?auto=format&fit=crop&w=1000&q=85',
  },
];

const categories = ['Todos', 'Automáticos', 'Deportivos', 'Diarios', 'Elegantes', 'Smartwatch'];
const formatPrice = (price: number) => `$${price.toLocaleString('es-CO')}`;

export default function Storefront({ businessSlug }: { businessSlug: string }) {
  const [category, setCategory] = useState('Todos');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const visibleProducts = useMemo(() => {
    const matching = products.filter((product) => {
      const matchesCategory = category === 'Todos' || product.category === category;
      const matchesQuery = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim());
      return matchesCategory && matchesQuery;
    });

    if (sort === 'price-asc') return [...matching].sort((first, second) => first.price - second.price);
    if (sort === 'price-desc') return [...matching].sort((first, second) => second.price - first.price);
    return matching;
  }, [category, query, sort]);

  function toggleFavorite(name: string) {
    setFavorites((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] pb-20 text-[#1d2923]">
      <div className="bg-[#1d2923] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        Envío gratis en Colombia · 12 meses de garantía
      </div>
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f7f7f3]/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Chronos Watches, inicio">
            <span className="grid size-10 place-items-center rounded-full border border-[#a88d5c] font-serif text-lg text-[#a88d5c]">C</span>
            <span>
              <span className="block font-serif text-lg leading-tight">CHRONOS</span>
              <span className="block text-[9px] font-medium uppercase text-stone-500">Watches · Bogotá</span>
            </span>
          </a>
          <nav aria-label="Navegación principal" className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
            <a href="#coleccion" className="transition hover:text-[#a88d5c]">Colección</a>
            <a href="#historia" className="transition hover:text-[#a88d5c]">Nuestra esencia</a>
            <a href="#servicio" className="transition hover:text-[#a88d5c]">Servicio</a>
          </nav>
          <a href="#coleccion" className="flex items-center gap-2 text-sm font-semibold text-[#1d2923] transition hover:text-[#a88d5c]">
            Explorar <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section id="inicio" className="relative isolate overflow-hidden bg-[#18251e] text-white">
        <div className="absolute inset-0 -z-20 bg-[#18251e]" />
        <div className="absolute inset-y-0 right-0 -z-10 w-full md:w-[64%]">
          <Image
            src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1900&q=90"
            alt="Reloj Chronos clásico con correa de cuero"
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
              <span className="h-px w-8 bg-[#d5bd8d]" /> Hechos para acompañar tu tiempo
            </p>
            <h1 className="mt-6 font-serif text-5xl leading-[1.04] sm:text-6xl">Cada segundo, <span className="italic text-[#d5bd8d]">a tu manera.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-stone-200">Relojería con carácter para los días que se convierten en historia.</p>
            <a href="#coleccion" className="mt-8 inline-flex items-center gap-3 border border-[#d5bd8d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d5bd8d] hover:text-[#18251e]">
              Descubrir colección <ArrowRight size={16} />
            </a>
            <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="ml-3 mt-3 inline-flex items-center gap-2 px-3 py-3 text-sm font-semibold text-white transition hover:text-[#d5bd8d]">
              Resolver dudas antes de comprar <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="absolute bottom-7 right-8 hidden items-center gap-3 text-xs text-stone-200 md:flex"><span className="h-px w-10 bg-[#d5bd8d]" /> COLECCIÓN 2025</div>
      </section>

      <section id="historia" className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:grid-cols-3 sm:px-8">
        {[
          { title: 'Diseño con intención', body: 'Piezas que equilibran precisión y personalidad.' },
          { title: '12 meses de garantía', body: 'Acompañamiento experto después de tu compra.' },
          { title: 'Envío asegurado', body: 'Recibe tu Chronos donde estés en Colombia.' },
        ].map((item, index) => (
          <div key={item.title} className={`border-l-2 pl-4 ${index === 1 ? 'border-[#a88d5c]' : 'border-[#53695b]'}`}>
            <h2 className="font-serif text-lg">{item.title}</h2>
            <p className="mt-1 text-sm text-stone-500">{item.body}</p>
          </div>
        ))}
      </section>

      <section id="coleccion" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 pt-7 sm:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-stone-300 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-[#92784e]">Curaduría Chronos</p>
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
                <input aria-label="Buscar relojes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo o estilo" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-stone-400" />
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
                    <Image src={product.image} alt={`Reloj Chronos ${product.name}`} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.035]" />
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
                      <h3 className="mt-1 font-serif text-2xl">Chronos {product.name}</h3>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{formatPrice(product.price)}</p>
                      <p className="mt-0.5 text-xs text-stone-400 line-through">{formatPrice(product.oldPrice)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setSelectedProduct(product)} className="flex-1 border border-[#1d2923] px-3 py-2.5 text-sm font-semibold transition hover:bg-[#1d2923] hover:text-white">Ver detalles</button>
                    <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="grid size-11 place-items-center border border-stone-300 text-[#1d2923] transition hover:border-[#1d2923]" aria-label={`Preguntar al asistente sobre Chronos ${product.name}`}>
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
            <p className="text-xs font-semibold uppercase text-[#92784e]">Atención personal</p>
            <h2 className="mt-2 font-serif text-3xl">¿Buscas algo especial?</h2>
            <p className="mt-2 text-sm text-stone-600">Te ayudamos a encontrar el reloj perfecto para tu ocasión.</p>
          </div>
          <button onClick={() => window.dispatchEvent(new Event('open-store-assistant'))} className="inline-flex items-center justify-center gap-2 self-start border border-[#1d2923] px-5 py-3 text-sm font-semibold transition hover:bg-[#1d2923] hover:text-white md:self-auto">Resolver mis dudas <ArrowRight size={16} /></button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-serif text-sm text-[#1d2923]">CHRONOS WATCHES</p>
        <p>© 2025 Chronos Watches · Bogotá, Colombia</p>
      </footer>

      {selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#101812]/65 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="quick-view-title" className="relative grid max-h-[92dvh] w-full max-w-4xl grid-cols-1 overflow-y-auto bg-[#f7f7f3] sm:grid-cols-2">
            <button onClick={() => setSelectedProduct(null)} aria-label="Cerrar detalles" className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-stone-700"><X size={19} /></button>
            <div className="relative min-h-64 bg-[#eae8e1] sm:min-h-[520px]">
              <Image src={selectedProduct.image} alt={`Reloj Chronos ${selectedProduct.name}`} fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <p className="text-xs font-semibold uppercase text-[#92784e]">{selectedProduct.category}</p>
              <h2 id="quick-view-title" className="mt-2 font-serif text-4xl">Chronos {selectedProduct.name}</h2>
              <p className="mt-4 text-2xl font-semibold">{formatPrice(selectedProduct.price)} <span className="ml-2 text-base font-normal text-stone-400 line-through">{formatPrice(selectedProduct.oldPrice)}</span></p>
              <p className="mt-5 text-sm leading-6 text-stone-600">{selectedProduct.description}</p>
              <ul className="mt-6 space-y-3 border-y border-stone-300 py-5">
                {selectedProduct.specs.map((spec) => <li key={spec} className="flex items-center gap-2 text-sm text-stone-700"><Check size={15} className="text-[#75866f]" /> {spec}</li>)}
              </ul>
              <button onClick={() => { setSelectedProduct(null); window.dispatchEvent(new Event('open-store-assistant')); }} className="mt-6 flex items-center justify-center gap-2 bg-[#1d2923] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#354b3e]">Preguntar al asistente <ArrowRight size={16} /></button>
              <p className="mt-3 text-center text-xs text-stone-500">Envío gratis · 12 meses de garantía</p>
            </div>
          </section>
        </div>
      )}

      <StoreChat businessSlug={businessSlug} />
    </main>
  );
}