export default function DashboardPage() {
  const metrics = [
    { label: 'Visitantes', value: '12.430' },
    { label: 'Consultas', value: '1.980' },
    { label: 'Resueltas automáticamente', value: '78%' },
    { label: 'Leads generados', value: '214' },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <aside className="mb-8 flex flex-wrap gap-3 text-sm text-slate-600">
          {['Resumen', 'Catálogo', 'Categorías', 'FAQ', 'Leads', 'Conversaciones', 'Analítica', 'Configuración'].map((item) => (
            <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-2">
              {item}
            </span>
          ))}
        </aside>

        <div className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
