import Storefront from './storefront';

export default function StorePage({ params }: { params: { businessSlug: string } }) {
  return <Storefront businessSlug={params.businessSlug} />;
}
