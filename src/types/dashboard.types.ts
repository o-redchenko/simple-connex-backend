export type DashboardPeriod = "7days" | "1year" | "alltime";
export type LocationPeriod = "month" | "year" | "alltime";
export type PurchasedItemPeriod = "month" | "year" | "alltime";
export type TransactionChartType = "purchases" | "topup" | "all";

export type OverviewStats = {
  total_users: number;
  total_purchases: number;
  new_users_today: number;
};

export type ChartDataPoint = {
  date: Date;
  count: number;
};

export type ChartData = {
  period: DashboardPeriod;
  chart_data: ChartDataPoint[];
};

export type PurchasesChartDataPoint = ChartDataPoint & {
  revenue: number;
};

export type PieChartItem = {
  name: string;
  revenue: number;
  percentage: number;
};

export type TopLocationItem = {
  id: number;
  name: string;
  revenue: number;
  items_sold: number;
  order_count: number;
};

export type TopLocationsData = {
  period: LocationPeriod;
  pie_chart: PieChartItem[];
  top_3_list: TopLocationItem[];
};

export type PurchasedItemData = {
  name: string;
  image_url: string | null;
  quantity_sold: number;
  revenue: number;
  menu_item_id: number | null;
};

export type OrderItemSummary = {
  item_name: string;
  total_quantity: number;
  revenue: number;
  order_count: number;
};

export type PurchasedItem = {
  name: string;
  quantity_sold: number;
  revenue: number;
  order_count: number;
};

export type LatestTransactionItem = {
  id: number;
  type: string;
  amount: number;
  user_name: string;
  user_email: string;
  order_id: number | null;
  order_status: string | null;
  created_at: Date;
};

export type TransactionChartPoint = {
  hour: string;
  hour_display: string;
  count: number;
  total_amount: number;
};

export type TransactionChartData = {
  type: TransactionChartType;
  chart_data: TransactionChartPoint[];
};

// Query Params
export type DashboardQuery = {
  period?: DashboardPeriod;
};

export type LocationDashboardQuery = {
  period?: LocationPeriod;
};

export type ItemsQuery = {
  period?: LocationPeriod;
  location_id?: string;
};

export type TransactionChartQuery = {
  type?: TransactionChartType;
};

export type QuickStats = {
  today: number;
  yesterday: number;
  seven_day_average: number;
};
