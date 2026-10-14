export type OrderStatus = 'PENDING_TRANSFER' | 'PAID' | 'CANCELLED';

export interface OrderLine {
  productId: string;
  productSlug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderLine[];
  customer: OrderCustomer;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface CreateOrderResponse {
  orderNumber: string;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  bankTransfer: {
    bankName: string;
    accountType: 'SAVINGS' | 'CHECKING';
    accountNumber: string;
    accountHolder: string;
    instructions: string;
  };
}
