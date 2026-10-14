import Storefront from './storefront';

export default async function StorePage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  return <Storefront businessSlug={businessSlug} />;
}
