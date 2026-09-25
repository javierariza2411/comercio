import StoreChat from './store-chat';

export default function StorePage({ params }: { params: { businessSlug: string } }) {
  const { businessSlug } = params;

  return (
    <main className="min-h-screen bg-stone-50 pb-16">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">Chronos Watches</p>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <span>Buscar</span>
            <span>Categorías</span>
            <span>Ayuda</span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-700 p-8 text-white md:p-12">
          <p className="text-sm uppercase tracking-[0.2em] text-stone-300">Tienda</p>
          <h1 className="mt-3 max-w-xl text-4xl font-bold md:text-5xl">
            Encuentra el reloj perfecto para ti
          </h1>
          <p className="mt-4 max-w-xl text-stone-200">
            Relojes automáticos, deportivos y elegantes para cada estilo de vida.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Catálogo</h2>
          <span className="text-sm text-slate-500">{businessSlug}</span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { name: 'Chronos Automatic Classic', price: '$649.900', tag: 'Automático' },
            { name: 'Chronos Diver Pro', price: '$799.900', tag: 'Deportivo' },
            { name: 'Chronos Urban', price: '$529.900', tag: 'Elegante' },
            { name: 'Chronos Sport X', price: '$689.900', tag: 'Deportivo' },
            { name: 'Chronos Elegance', price: '$899.900', tag: 'Premium' },
            { name: 'Chronos Smart One', price: '$1.099.900', tag: 'Smartwatch' },
          ].map((item) => (
            <article key={item.name} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="h-56 bg-gradient-to-br from-stone-200 via-stone-100 to-amber-100" />
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{item.tag}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{item.name}</h3>
                <p className="mt-3 text-2xl font-bold text-slate-900">{item.price}</p>
                <div className="mt-5 flex gap-3">
                  <button className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Ver detalles
                  </button>
                  <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                    Consultar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <StoreChat businessSlug={businessSlug} />
    </main>
  );
}
