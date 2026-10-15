'use client';

import { useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { ArrowRight, BookOpen, Check, LockKeyhole, LogOut, Package, Pencil, Plus, Trash2, UploadCloud, Wallet, X } from 'lucide-react';
import { formatMoney, type Order, type OrderStatus } from '@smartcommerce/shared';

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
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  stock: number;
  active: boolean;
  images: string[];
  metadata: { offer?: OfferMetadata };
};

type OfferMetadata = { enabled: boolean; percent: number; startsAt?: string; endsAt?: string };
type FaqItem = { id: string; question: string; answer: string; keywords: string[]; category: string; active: boolean };

type ProductForm = {
  name: string;
  description: string;
  price: string;
  stock: string;
  image: File | null;
  discountEnabled: boolean;
  discountPercent: string;
  offerStartsAt: string;
  offerEndsAt: string;
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
const emptyProductForm: ProductForm = { name: '', description: '', price: '', stock: '0', image: null, discountEnabled: false, discountPercent: '10', offerStartsAt: '', offerEndsAt: '' };

export default function DashboardPage() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [token, setToken] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [payment, setPayment] = useState<PaymentForm>(emptyPaymentForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', keywords: '' });
  const [product, setProduct] = useState<ProductForm>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [draggingImage, setDraggingImage] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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

  async function loadFaqs(accessToken: string) {
    const response = await fetch(`${apiUrl}/faq?includeInactive=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error('No pudimos cargar el conocimiento del asistente.');
    setFaqs(await response.json());
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
      await Promise.all([loadOrders(result.accessToken), loadProducts(result.accessToken), loadFaqs(result.accessToken)]);
      setCredentials({ email: '', password: '' });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let images: string[] = existingImage ? [existingImage] : [];
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

      const response = await fetch(`${apiUrl}/catalog/products${editingProductId ? `/${editingProductId}` : ''}`, {
        method: editingProductId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          priceCents: discountedPriceCents(product),
          compareAtPriceCents: product.discountEnabled ? Math.round(Number(product.price) * 100) : null,
          stock: Number(product.stock),
          trackStock: true,
          currency: 'COP',
          images,
          metadata: {
            offer: {
              enabled: product.discountEnabled,
              percent: product.discountEnabled ? Number(product.discountPercent) : 0,
              startsAt: product.offerStartsAt ? new Date(product.offerStartsAt).toISOString() : undefined,
              endsAt: product.offerEndsAt ? new Date(product.offerEndsAt).toISOString() : undefined,
            },
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, `No pudimos ${editingProductId ? 'actualizar' : 'crear'} el producto.`));
      const wasEditing = Boolean(editingProductId);
      resetProductForm();
      await loadProducts(token);
      setNotice(`Producto “${result.name}” ${wasEditing ? 'actualizado' : 'creado'} correctamente.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0] ?? null;
    if (image) setSelectedImage(image);
    event.target.value = '';
  }

  function setSelectedImage(image: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(image.type)) {
      setError('Selecciona una imagen JPEG, PNG, WebP o GIF.');
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5 MB.');
      return;
    }
    setError('');
    setExistingImage('');
    setImagePreview(URL.createObjectURL(image));
    setProduct((current) => ({ ...current, image }));
  }

  function dropImage(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingImage(false);
    const image = event.dataTransfer.files?.[0];
    if (image) setSelectedImage(image);
  }

  function editProduct(item: CatalogProduct) {
    resetProductForm();
    setEditingProductId(item.id);
    setExistingImage(item.images[0] || '');
    const offer = item.metadata?.offer;
    const basePriceCents = item.compareAtPriceCents || item.priceCents;
    setProduct({
      name: item.name,
      description: item.description || '',
      price: String(basePriceCents / 100),
      stock: String(item.stock),
      image: null,
      discountEnabled: Boolean(offer?.enabled && item.compareAtPriceCents),
      discountPercent: String(offer?.percent || discountPercent(item.priceCents, item.compareAtPriceCents) || 10),
      offerStartsAt: toLocalDateTime(offer?.startsAt),
      offerEndsAt: toLocalDateTime(offer?.endsAt),
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 180, behavior: 'smooth' });
  }

  function resetProductForm() {
    setProduct(emptyProductForm);
    setEditingProductId(null);
    setExistingImage('');
    setImagePreview('');
    setDraggingImage(false);
  }

  async function deleteProduct(item: CatalogProduct) {
    if (!window.confirm(`¿Eliminar “${item.name}”? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${apiUrl}/catalog/products/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, 'No pudimos eliminar el producto.'));
      if (editingProductId === item.id) resetProductForm();
      await loadProducts(token);
      setNotice(`Producto “${item.name}” eliminado.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
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

  async function createFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${apiUrl}/faq`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: faqForm.question, answer: faqForm.answer, keywords: faqForm.keywords.split(',').map((item) => item.trim()).filter(Boolean), category: 'tienda', active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, 'No pudimos guardar la respuesta.'));
      setFaqForm({ question: '', answer: '', keywords: '' });
      await loadFaqs(token);
      setNotice('Conocimiento agregado al asistente.');
    } catch (faqError) { setError(faqError instanceof Error ? faqError.message : 'No pudimos conectar con el servidor.'); }
    finally { setBusy(false); }
  }

  async function deleteFaq(item: FaqItem) {
    if (!window.confirm(`¿Eliminar la respuesta “${item.question}”?`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/faq/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, 'No pudimos eliminar la respuesta.'));
      await loadFaqs(token); setNotice('Respuesta eliminada del conocimiento.');
    } catch (faqError) { setError(faqError instanceof Error ? faqError.message : 'No pudimos conectar con el servidor.'); }
    finally { setBusy(false); }
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

  async function updateOrderStatus(orderNumber: string, status: OrderStatus) {
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/orders/${encodeURIComponent(orderNumber)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, 'No pudimos actualizar el pedido.'));
      await loadOrders(token);
      setNotice(`Pedido ${orderNumber}: ${orderStatusLabel(status)}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'No pudimos conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    setToken('');
    setPayment(emptyPaymentForm);
    setOrders([]);
    setProducts([]);
    setFaqs([]);
    setProduct(emptyProductForm);
    setEditingProductId(null);
    setExistingImage('');
    setImagePreview('');
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
                <form onSubmit={saveProduct} className="border border-stone-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-semibold">{editingProductId ? <Pencil size={18} /> : <Plus size={18} />} {editingProductId ? 'Editar producto' : 'Nuevo producto'}</h3>
                    {editingProductId && <button type="button" onClick={resetProductForm} className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-950"><X size={15} /> Cancelar</button>}
                  </div>
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
                    <div className="border border-stone-200 bg-stone-50 p-4">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={product.discountEnabled} onChange={(event) => setProduct({ ...product, discountEnabled: event.target.checked })} className="mt-1 size-4 accent-[#20352b]" />
                        <span><span className="block text-sm font-semibold">Oferta o descuento</span><span className="mt-1 block text-xs text-stone-500">Muestra el precio anterior, el descuento y su vigencia en la tienda.</span></span>
                      </label>
                      {product.discountEnabled && <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">Descuento (%)
                          <input required min="1" max="99" step="1" type="number" value={product.discountPercent} onChange={(event) => setProduct({ ...product, discountPercent: event.target.value })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 outline-none focus:border-[#53695b]" />
                        </label>
                        <div className="border-l-2 border-emerald-600 bg-white px-3 py-2 text-sm">
                          <span className="block text-xs text-stone-500">Precio con descuento</span>
                          <strong className="mt-1 block text-emerald-700">{formatMoney(discountedPriceCents(product), 'COP')}</strong>
                        </div>
                        <label className="text-sm font-medium">Inicia <span className="font-normal text-stone-500">(opcional)</span>
                          <input type="datetime-local" value={product.offerStartsAt} onChange={(event) => setProduct({ ...product, offerStartsAt: event.target.value })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                        </label>
                        <label className="text-sm font-medium">Finaliza <span className="font-normal text-stone-500">(opcional)</span>
                          <input type="datetime-local" min={product.offerStartsAt || undefined} value={product.offerEndsAt} onChange={(event) => setProduct({ ...product, offerEndsAt: event.target.value })} className="mt-2 w-full border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-[#53695b]" />
                        </label>
                      </div>}
                    </div>
                    <label
                      onDragEnter={(event) => { event.preventDefault(); setDraggingImage(true); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={(event) => { event.preventDefault(); setDraggingImage(false); }}
                      onDrop={dropImage}
                      className={`block cursor-pointer border border-dashed p-4 text-center transition ${draggingImage ? 'border-[#20352b] bg-emerald-50' : 'border-stone-400 bg-stone-50 hover:border-[#53695b]'}`}
                    >
                      {(imagePreview || existingImage) ? (
                        <img src={imagePreview || existingImage} alt="Vista previa del producto" className="mx-auto h-40 w-full object-contain" />
                      ) : <UploadCloud className="mx-auto text-stone-500" size={28} />}
                      <span className="mt-2 block text-sm font-semibold">{product.image?.name || (existingImage ? 'Imagen actual' : 'Arrastra una imagen o haz clic')}</span>
                      <span className="mt-1 block text-xs text-stone-500">JPEG, PNG, WebP o GIF · máximo 5 MB</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} className="sr-only" />
                    </label>
                  </div>
                  <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#20352b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    <Package size={16} /> {busy ? 'Guardando...' : editingProductId ? 'Guardar cambios' : 'Publicar producto'}
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
                            {item.metadata?.offer?.enabled && item.compareAtPriceCents ? <p className="mt-1 text-xs font-semibold text-red-700">Oferta {item.metadata.offer.percent}% · base {formatMoney(item.compareAtPriceCents, item.currency)}</p> : null}
                            <p className={`mt-2 text-xs font-medium ${item.active ? 'text-emerald-700' : 'text-stone-500'}`}>{item.active ? 'Publicado' : 'Oculto'}</p>
                            <div className="mt-3 flex gap-3">
                              <button type="button" disabled={busy} onClick={() => editProduct(item)} className="flex items-center gap-1 text-xs font-semibold text-[#315343] hover:underline disabled:opacity-50"><Pencil size={14} /> Editar</button>
                              <button type="button" disabled={busy} onClick={() => deleteProduct(item)} className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"><Trash2 size={14} /> Eliminar</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className="border-b border-stone-300 pb-4"><p className="text-xs font-semibold uppercase text-[#92784e]">Agente especializado</p><h2 className="mt-1 font-serif text-3xl">Conocimiento del asistente</h2><p className="mt-2 max-w-2xl text-sm text-stone-600">Agrega respuestas verificadas. El agente consulta esta información desde Neon y no utiliza servicios de IA externos.</p></div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <form onSubmit={createFaq} className="border border-stone-200 bg-white p-5 sm:p-6">
                  <h3 className="flex items-center gap-2 font-semibold"><BookOpen size={18} /> Nueva respuesta</h3>
                  <label className="mt-5 block text-sm font-medium">Pregunta frecuente<input required minLength={3} maxLength={300} value={faqForm.question} onChange={(event) => setFaqForm({ ...faqForm, question: event.target.value })} placeholder="¿Cuánto dura la garantía?" className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" /></label>
                  <label className="mt-4 block text-sm font-medium">Respuesta verificada<textarea required minLength={3} maxLength={2000} rows={5} value={faqForm.answer} onChange={(event) => setFaqForm({ ...faqForm, answer: event.target.value })} placeholder="Escribe la política exacta del comercio." className="mt-2 w-full resize-y border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" /></label>
                  <label className="mt-4 block text-sm font-medium">Palabras clave <span className="font-normal text-stone-500">(separadas por coma)</span><input maxLength={400} value={faqForm.keywords} onChange={(event) => setFaqForm({ ...faqForm, keywords: event.target.value })} placeholder="garantía, reparación, cobertura" className="mt-2 w-full border border-stone-300 px-3 py-3 outline-none focus:border-[#53695b]" /></label>
                  <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#20352b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} /> Guardar conocimiento</button>
                </form>
                <div className="border border-stone-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h3 className="font-semibold">Respuestas publicadas</h3><span className="text-xs text-stone-500">{faqs.length} en total</span></div>{!faqs.length ? <p className="py-10 text-center text-sm text-stone-500">Aún no hay respuestas personalizadas.</p> : <div className="mt-4 divide-y divide-stone-200">{faqs.map((faq) => <article key={faq.id} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{faq.question}</p><p className="mt-1 text-sm leading-6 text-stone-600">{faq.answer}</p>{faq.keywords.length ? <p className="mt-2 text-xs text-stone-400">{faq.keywords.join(' · ')}</p> : null}</div><button disabled={busy} onClick={() => deleteFaq(faq)} aria-label={`Eliminar ${faq.question}`} className="shrink-0 text-red-700 disabled:opacity-50"><Trash2 size={16} /></button></div></article>)}</div>}</div>
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
                      <p className="font-semibold">{order.orderNumber} <span className={`ml-2 text-xs font-medium ${['PAID', 'DELIVERED'].includes(order.status) ? 'text-emerald-800' : 'text-[#9a5b16]'}`}>{orderStatusLabel(order.status)}</span></p>
                      <p className="mt-1 text-sm text-stone-600">{order.customer.name} · {order.customer.phone} · {order.customer.city}</p>
                      <p className="mt-2 text-xs text-stone-500">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p>
                      <p className="mt-1 text-xs text-stone-500">{order.customer.address}{order.customer.addressComplement ? ` · ${order.customer.addressComplement}` : ''}</p>
                      {order.shipping?.name && <p className="mt-1 text-xs font-medium text-stone-600">Envío: {order.shipping.name}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="font-semibold">{formatMoney(order.totalCents, order.currency)}</p>
                      {order.status === 'PENDING_TRANSFER' && <button disabled={busy} onClick={() => confirmOrder(order.orderNumber)} className="border border-[#20352b] px-3 py-2 text-xs font-semibold text-[#20352b] hover:bg-[#20352b] hover:text-white disabled:opacity-50">Confirmar pago recibido</button>}
                      <select disabled={busy} value={order.status} onChange={(event) => updateOrderStatus(order.orderNumber, event.target.value as OrderStatus)} aria-label={`Estado de ${order.orderNumber}`} className="border border-stone-300 bg-white px-2 py-2 text-xs outline-none">
                        <option value="PENDING_TRANSFER">Pendiente de pago</option><option value="PAID">Pago confirmado</option><option value="PREPARING">Preparando</option><option value="SHIPPED">Enviado</option><option value="DELIVERED">Entregado</option><option value="CANCELLED">Cancelado</option><option value="REFUNDED">Reembolsado</option>
                      </select>
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

function discountedPriceCents(product: ProductForm) {
  const base = Math.round((Number(product.price) || 0) * 100);
  if (!product.discountEnabled) return base;
  return Math.round(base * (1 - (Number(product.discountPercent) || 0) / 100));
}

function discountPercent(priceCents: number, compareAtPriceCents: number | null) {
  if (!compareAtPriceCents || compareAtPriceCents <= priceCents) return 0;
  return Math.round((1 - priceCents / compareAtPriceCents) * 100);
}

function toLocalDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function orderStatusLabel(status: OrderStatus) {
  return ({ PENDING_TRANSFER: 'Pendiente de pago', PAID: 'Pago confirmado', PREPARING: 'Preparando', SHIPPED: 'Enviado', DELIVERED: 'Entregado', PAYMENT_FAILED: 'Pago rechazado', REFUNDED: 'Reembolsado', CANCELLED: 'Cancelado' } satisfies Record<OrderStatus, string>)[status];
}
