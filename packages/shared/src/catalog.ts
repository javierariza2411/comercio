export type ProductType = 'PRODUCT' | 'SERVICE';

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
}

export interface PublicVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number | null;
  stock: number;
  attributes: Record<string, unknown>;
  imageUrl: string;
}

export interface PublicProduct {
  id: string;
  categoryId: string | null;
  type: ProductType;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  images: string[];
  featured: boolean;
  stock: number;
  trackStock: boolean;
  attributes: Record<string, unknown>;
  tags: string[];
  variants: PublicVariant[];
}

/** Forma de `GET /catalog/public/:slug`. */
export interface PublicCatalog {
  categories: PublicCategory[];
  products: PublicProduct[];
}
