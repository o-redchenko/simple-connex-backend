export type TransactionType = "order_payment" | "balance_topup" | "refund";

export type TransactionStatus = "pending" | "completed" | "failed";

export type Transaction = {
  id: number;
  user_id: number;
  type: "purchase" | "topup";
  amount: number;
  balance_after: number;
  description: string | null;
  order_id: number | null;
  created_at: Date;
};

export type TransactionWithUser = Transaction & {
  first_name: string;
  last_name: string;
  email: string;
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
