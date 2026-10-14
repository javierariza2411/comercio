import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 via-white to-stone-100">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm md:p-12">
          <div className="mb-6 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            SmartCommerce • Chronos Watches
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Encuentra el reloj perfecto sin convertir WhatsApp en un tablero de consultas repetitivas.
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            Plataforma SaaS multi-tenant para resolver catálogo, preguntas frecuentes, disponibilidad
            y compra con cierre directo por WhatsApp.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/tienda/chronos-watches"
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Ver tienda demo
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              'Catálogo inteligente',
              'FAQ automática',
              'Cierre por WhatsApp',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-medium text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
