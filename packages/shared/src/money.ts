/**
 * Los precios se guardan en centavos (minor units) como enteros.
 * COP no usa decimales en la práctica, pero las pasarelas (Wompi, Stripe) trabajan en centavos.
 */
export function formatMoney(cents: number, currency = 'COP', locale = 'es-CO'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount);
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
