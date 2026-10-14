'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowRight, Check, ImagePlus, LockKeyhole, LogOut, Package, Plus, Wallet } from 'lucide-react';
import { formatMoney, type Order } from '@smartcommerce/shared';

type PaymentForm = {
  bankTransferEnabled: boolean;
  bankName: string;
  accountType: 'SAVINGS' | 'CHECKING';
  accountNumber: string;
  accountHolder: string;
  instructions: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  stock: number;
  active: boolean;
  images: string[];
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  stock: string;
  image: File | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const emptyPaymentForm: PaymentForm = {
  bankTransferEnabled: false,
  bankName: '',
  accountType: 'SAVINGS',
  accountNumber: '',
  accountHolder: '',
  instructions: '',
};
const emptyProductForm: ProductForm = { name: '', description: '', price: '', stock: '0', image: null };

export default function DashboardPage() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [token, setToken] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [payment, setPayment] = useState<PaymentForm>(emptyPaymentForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [product, setProduct] = useState<ProductForm>(emptyProductForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOrders(accessToken: string) {
    const response = await fetch(`${apiUrl}/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('No pudimos cargar los pedidos.');
    setOrders(await response.json());
  }

  async function loadProducts(accessToken: string) {
    const response = await fetch(`${apiUrl}/catalog/products?includeInactive=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('No pudimos cargar los productos.');
    setProducts(await response.json());
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No pudimos iniciar sesión. Revisa tus datos.');
      setToken(result.accessToken);
      setBusinessName(result.tenant?.name || 'Tu tienda');
      setPayment({ ...emptyPaymentForm, ...result.tenant?.paymentSettings });
      await Promise.all([loadOrders(result.accessToken), loadProducts(result.accessToken)]);
      setCredentials({ email: '', password: '' });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let images: string[] = [];
      if (product.image) {
        const formData = new FormData();
        formData.append('file', product.image);
        const uploadResponse = await fetch(`${apiUrl}/assets/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const upload = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(messageFrom(upload, 'No pudimos subir la imagen.'));
        images = [upload.publicUrl];
      }

      const response = await fetch(`${apiUrl}/catalog/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          priceCents: Math.round(Number(product.price) * 100),
          stock: Number(product.stock),
          trackStock: true,
          currency: 'COP',
          images,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, 'No pudimos crear el producto.'));
      setProduct(emptyProductForm);
      await loadProducts(token);
      setNotice(`Producto “${result.name}” creado correctamente.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0] ?? null;
    setProduct({ ...product, image });
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${apiUrl}/tenants/me/payment-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payment),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No pudimos guardar la configuración.');
      setNotice('Datos guardados. La transferencia ya aparece en tu tienda.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder(orderNumber: string) {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/orders/${encodeURIComponent(orderNumber)}/confirm-transfer`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No pudimos confirmar el pedido.');
      await loadOrders(token);
      setNotice(`Transferencia de ${orderNumber} confirmada.`);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'No pudimos conectar con el servidor.');
    }
  }

  function signOut() {
    setToken('');
    setPayment(emptyPaymentForm);
    setOrders([]);
    setProducts([]);
    setProduct(emptyProductForm);
    setBusinessName('');
    setNotice('');
    setError('');
  }

  return (
    <main className="min-h-screen bg-[#f4f5f1] text-[#202922]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-[#20352b] text-white"><Wallet size={19} /></span>
            <div><p className="text-xs font-semibold uppercase text-stone-500">SmartCommerce</p><p className="font-serif text-lg">Pagos de tu tienda</p></div>
          </div>
          {token && <button onClick={signOut} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-950"><LogOut size={16} /> Salir</button>}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {!token ? (
          <div className="mx-auto max-w-md">
            <p className="text-xs font-semibold uppercase text-[#92784e]">Acceso de comercio</p>
            <h1 className="mt-2 font-serif text-4xl">Configura cómo recibes pagos.</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">Inicia sesión para registrar la cuenta bancaria que se mostrará al cliente al crear su pedido.</p>
            <form onSubmit={signIn} className="mt-8 space-y-4">
              <label className="block text-sm font-medium">Correo
                <input required type="email" autoComplete="username" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#53695b]" />
              </label>
              <label className="block text-sm font-medium">Contraseña
                <input required type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#53695b]" />
              </label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 bg-[#20352b] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Validando...' : 'Entrar'} <ArrowRight size={16} /></button>
            </form>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase text-[#92784e]">Configuración de {businessName}</p>
            <h1 className="mt-2 font-serif text-4xl">Administra tu comercio</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">Publica productos con imágenes, configura tus pagos y revisa los pedidos desde un solo lugar.</p>

            <section className="mt-10">
              <div className="border-b border-stone-300 pb-4">
                <p className="text-xs font-semibold uppercase text-[#92784e]">Catálogo</p>
                <h2 className="mt-1 font-serif text-3xl">Productos e imágenes</h2>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <form onSubmit={createProduct} className="border border-stone-200 bg-white p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Nuevo producto</h3>
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-medium">Nombre
                      <input required maxLength={200} value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                    </label>
                    <label className="block text-sm font-medium">Descripción
                      <textarea maxLength={5000} rows={3} value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} className="mt-2 w-full resize-y border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="text-sm font-medium">Precio (COP)
                        <input required min="0" step="0.01" type="number" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                      </label>
                      <label className="text-sm font-medium">Existencias
                        <input required min="0" step="1" type="number" value={product.stock} onChange={(event) => setProduct({ ...product, stock: event.target.value })} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                      </label>
                    </div>
                    <label className="block cursor-pointer border border-dashed border-stone-400 bg-stone-50 p-4 text-center hover:border-[#53695b]">
                      <ImagePlus className="mx-auto text-stone-500" size={24} />
                      <span className="mt-2 block text-sm font-semibold">{product.image?.name || 'Seleccionar imagen'}</span>
                      <span className="mt-1 block text-xs text-stone-500">JPEG, PNG, WebP o GIF · máximo 5 MB</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} className="sr-only" />
                    </label>
                  </div>
                  <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#20352b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    <Package size={16} /> {busy ? 'Guardando...' : 'Publicar producto'}
                  </button>
                </form>

                <div className="border border-stone-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4"><h3 className="font-semibold">Productos publicados</h3><span className="text-xs text-stone-500">{products.length} en total</span></div>
                  {!products.length ? <p className="py-10 text-center text-sm text-stone-500">Aún no hay productos.</p> : (
                    <div className="mt-4 divide-y divide-stone-200">
                      {products.map((item) => (
                        <article key={item.id} className="flex gap-4 py-4 first:pt-0">
                          {item.images[0] ? <img src={item.images[0]} alt="" className="size-20 shrink-0 object-cover" /> : <div className="grid size-20 shrink-0 place-items-center bg-stone-100 text-stone-400"><Package size={22} /></div>}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{item.name}</p>
                            <p className="mt-1 text-sm text-stone-600">{formatMoney(item.priceCents, item.currency)} · {item.stock} disponibles</p>
                            <p className={`mt-2 text-xs font-medium ${item.active ? 'text-emerald-700' : 'text-stone-500'}`}>{item.active ? 'Publicado' : 'Oculto'}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {error && <p role="alert" className="mt-6 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mt-6 flex items-center gap-2 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check size={16} /> {notice}</p>}

            <div className="mt-12 border-b border-stone-300 pb-4">
              <p className="text-xs font-semibold uppercase text-[#92784e]">Cobros</p>
              <h2 className="mt-1 font-serif text-3xl">Transferencia bancaria</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">El comprador verá estos datos al crear su pedido. Debes verificar el ingreso en tu banco.</p>
            </div>

            <form onSubmit={savePayment} className="mt-6 border border-stone-200 bg-white p-5 sm:p-7">
              <label className="flex cursor-pointer items-start gap-3 border-b border-stone-200 pb-5">
                <input type="checkbox" checked={payment.bankTransferEnabled} onChange={(event) => setPayment({ ...payment, bankTransferEnabled: event.target.checked })} className="mt-1 size-4 accent-[#20352b]" />
                <span><span className="block text-sm font-semibold">Habilitar transferencia directa</span><span className="mt-1 block text-xs leading-5 text-stone-500">Sin comisión de pasarela. El pago y su confirmación son responsabilidad del comercio.</span></span>
              </label>

              <fieldset disabled={!payment.bankTransferEnabled} className="mt-5 grid gap-4 sm:grid-cols-2 disabled:opacity-50">
                <label className="text-sm font-medium">Banco
                  <input required={payment.bankTransferEnabled} maxLength={80} value={payment.bankName} onChange={(event) => setPayment({ ...payment, bankName: event.target.value })} placeholder="Nombre del banco" className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                </label>
                <label className="text-sm font-medium">Tipo de cuenta
                  <select value={payment.accountType} onChange={(event) => setPayment({ ...payment, accountType: event.target.value as PaymentForm['accountType'] })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#53695b]">
                    <option value="SAVINGS">Ahorros</option><option value="CHECKING">Corriente</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Número de cuenta
                  <input required={payment.bankTransferEnabled} minLength={4} maxLength={40} value={payment.accountNumber} onChange={(event) => setPayment({ ...payment, accountNumber: event.target.value })} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                </label>
                <label className="text-sm font-medium">Titular de la cuenta
                  <input required={payment.bankTransferEnabled} maxLength={120} value={payment.accountHolder} onChange={(event) => setPayment({ ...payment, accountHolder: event.target.value })} className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                </label>
                <label className="text-sm font-medium sm:col-span-2">Instrucciones para el comprador <span className="font-normal text-stone-500">(opcional)</span>
                  <textarea maxLength={500} rows={3} value={payment.instructions} onChange={(event) => setPayment({ ...payment, instructions: event.target.value })} placeholder="Ejemplo: usa el número del pedido como referencia de pago." className="mt-2 w-full resize-y border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" />
                </label>
              </fieldset>

              <div className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-xs text-stone-500"><LockKeyhole size={14} /> Solo se comparte cuando el cliente genera un pedido.</p>
                <button disabled={busy} className="bg-[#20352b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando...' : 'Guardar configuración'}</button>
              </div>
            </form>

            <section className="mt-10">
              <div className="flex items-end justify-between gap-4 border-b border-stone-300 pb-4">
                <div><p className="text-xs font-semibold uppercase text-[#92784e]">Seguimiento de venta</p><h2 className="mt-1 font-serif text-3xl">Pedidos</h2></div>
                <button onClick={() => loadOrders(token).catch((loadError) => setError(loadError.message))} className="text-sm font-semibold text-stone-600 hover:text-stone-950">Actualizar</button>
              </div>
              {!orders.length ? <p className="py-8 text-sm text-stone-500">No hay pedidos todavía.</p> : <div className="divide-y divide-stone-200">
                {orders.map((order) => <article key={order.orderNumber} className="py-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-semibold">{order.orderNumber} <span className={`ml-2 text-xs font-medium ${order.status === 'PAID' ? 'text-emerald-800' : 'text-[#9a5b16]'}`}>{order.status === 'PAID' ? 'Transferencia confirmada' : 'Pendiente de transferencia'}</span></p>
                      <p className="mt-1 text-sm text-stone-600">{order.customer.name} · {order.customer.phone} · {order.customer.city}</p>
                      <p className="mt-2 text-xs text-stone-500">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p>
                      <p className="mt-1 text-xs text-stone-500">{order.customer.address}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="font-semibold">{formatMoney(order.totalCents, order.currency)}</p>
                      {order.status === 'PENDING_TRANSFER' && <button onClick={() => confirmOrder(order.orderNumber)} className="border border-[#20352b] px-3 py-2 text-xs font-semibold text-[#20352b] hover:bg-[#20352b] hover:text-white">Confirmar pago recibido</button>}
                    </div>
                  </div>
                </article>)}
              </div>}
            </section>

            <div className="mt-6 border-l-2 border-[#a88d5c] bg-white px-5 py-4 text-sm leading-6 text-stone-600">
              <strong className="text-stone-900">PSE y tarjetas aún no están conectados.</strong> Para aceptar esos métodos se necesita una pasarela y sus tarifas por transacción. La transferencia directa queda como opción inicial; no agregamos cargos recurrentes ni simulamos una confirmación automática.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function messageFrom(body: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(body.message)) return body.message.join('. ');
  return body.message || fallback;
}
