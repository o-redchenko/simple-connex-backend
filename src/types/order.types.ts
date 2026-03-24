export const ORDER_STATUSES = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUSES);

export type Order = {
  id: number;
  user_id: number;
  location_id: number;
  status: OrderStatus;
  total_amount: number;
  notes: string | null;
  created_at: Date;
};

export type OrderDetails = Order & {
  customer_email: string;
  customer_name: string;
  location_name: string;
  location_address: string;
  items: OrderItem[];
};

export type OrderItem = {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  item_name: string;
  item_description: string | null;
  quantity: number;
  base_price: number;
  total_price: number;
  created_at: Date;
};

export type OrderItemVariation = {
  id: number;
  order_item_id: number;
  variation_id: number | null;
  variation_name: string;
  price_adjustment: number;
  created_at: Date;
};

export type OrderItemModifier = {
  id: number;
  order_item_id: number;
  modifier_id: number | null;
  modifier_name: string;
  price: number;
  quantity: number;
  created_at: Date;
};

export type OrderItemWithDetails = OrderItem & {
  variation: OrderItemVariation | null;
  modifiers: OrderItemModifier[];
};

// Request Bodies
export type CreateOrderItemModifier = {
  modifier_id: number;
  quantity: number;
};

export type CreateOrderItem = {
  menu_item_id: number;
  quantity: number;
  variation_id: number;
  modifiers?: CreateOrderItemModifier[];
};

export type CreateOrderBody = {
  location_id: number;
  items: CreateOrderItem[];
  notes?: string;
};

export type UpdateOrderStatusBody = {
  status: OrderStatus;
};

// Query Params
export type OrdersQuery = {
  status?: OrderStatus;
  location_id?: string;
};
