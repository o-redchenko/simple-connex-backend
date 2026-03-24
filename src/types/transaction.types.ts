export type TransactionType = "order_payment" | "balance_topup" | "refund";

export type TransactionStatus = "pending" | "completed" | "failed";

export type Transaction = {
  id: number;
  user_id: number;
  order_id: number | null;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: TransactionStatus;
  payment_method: string | null;
  notes: string | null;
  created_at: Date;
};

// Request Bodies
export type TopUpBody = {
  amount: number;
  payment_method?: string;
};

// Query Params
export type TransactionsQuery = {
  type?: TransactionType;
  user_id?: string;
};
