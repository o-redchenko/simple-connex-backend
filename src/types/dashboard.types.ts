import { transactions, locations, menu_items } from "@prisma/client";
import { PrismaToFront } from "./utils.types";

// ========================================
// DASHBOARD PERIODS & TYPES
// ========================================

export type DashboardPeriod = "7days" | "1year" | "alltime";
export type LocationPeriod = "month" | "year" | "alltime";
export type TransactionChartType = "purchases" | "topup" | "all";

// ========================================
// ANALYTICS ENTITIES (Prisma-based)
// ========================================

export type OverviewStats = {
  total_users: number;
  total_purchases: number;
  new_users_today: number;
};

export type ChartDataPoint = {
  date: Date | string;
  count: number;
};

export type ChartData = {
  period: DashboardPeriod;
  chart_data: ChartDataPoint[];
};

export type PurchasesChartDataPoint = ChartDataPoint & {
  revenue: number;
};

export type TopLocationItem = Pick<locations, "id" | "name"> & {
  revenue: number;
  items_sold: number;
  order_count: number;
};

export type TopLocationsData = {
  period: LocationPeriod;
  pie_chart: Array<{
    name: string;
    revenue: number;
    percentage: number;
  }>;
  top_3_list: TopLocationItem[];
};

export type PurchasedItemData = {
  name: string;
  image_url: string | null;
  quantity_sold: number;
  revenue: number;
  menu_item_id: menu_items["id"] | null;
};

export type LatestTransactionItem = Pick<
  PrismaToFront<transactions>,
  "id" | "type" | "amount" | "created_at" | "order_id"
> & {
  user_name: string;
  user_email: string;
  order_status: string | null;
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

export type QuickStats = {
  today: number;
  yesterday: number;
  seven_day_average: number;
};

// ========================================
// QUERY PARAMS
// ========================================

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
