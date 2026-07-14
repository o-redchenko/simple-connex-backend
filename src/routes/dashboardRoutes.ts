import express, { Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  ChartData,
  ChartDataPoint,
  DashboardQuery,
  ItemsQuery,
  LocationDashboardQuery,
  OverviewStats,
  PurchasedItemData,
  PurchasesChartDataPoint,
  QuickStats,
  TopLocationItem,
  TopLocationsData,
  TransactionChartData,
  TransactionChartQuery,
} from "@/types";
import { Prisma } from "@prisma/client";

const router = express.Router();

// ===== OVERVIEW CARDS =====
router.get(
  "/overview",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<OverviewStats>>) => {
    try {
      const [totalUsers, totalPurchases, newUsersToday] = await Promise.all([
        prisma.users.count({ where: { role: "customer" } }),
        prisma.orders.aggregate({ _sum: { total_amount: true } }),
        prisma.users.count({
          where: {
            role: "customer",
            created_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          total_users: totalUsers,
          total_purchases: totalPurchases._sum.total_amount?.toNumber() || 0,
          new_users_today: newUsersToday,
        },
      });
    } catch (err) {
      console.error("Overview error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve overview statistics" });
    }
  },
);

// ===== NEW USERS CHART =====
router.get(
  "/new-users-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, DashboardQuery>,
    res: Response<APIResponse<ChartData>>,
  ) => {
    try {
      const { period = "7days" } = req.query;

      let result: ChartDataPoint[] = [];

      if (period === "7days") {
        result = await prisma.$queryRaw<ChartDataPoint[]>`
          SELECT DATE(created_at) as date, COUNT(*)::int as count
          FROM users
          WHERE role = 'customer' AND created_at >= NOW() - INTERVAL '6 days'
          GROUP BY DATE(created_at) ORDER BY date`;
      } else if (period === "1year") {
        result = await prisma.$queryRaw<ChartDataPoint[]>`
          SELECT DATE_TRUNC('month', created_at) as date, COUNT(*)::int as count
          FROM users
          WHERE role = 'customer' AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
          GROUP BY DATE_TRUNC('month', created_at) ORDER BY date`;
      } else if (period === "alltime") {
        result = await prisma.$queryRaw<ChartDataPoint[]>`
          SELECT DATE_TRUNC('year', created_at) as date, COUNT(*)::int as count
          FROM users
          WHERE role = 'customer' GROUP BY DATE_TRUNC('year', created_at) ORDER BY date`;
      }

      return res.json({ success: true, data: { period, chart_data: result } });
    } catch (err) {
      console.error("New users chart error:", err);
      return res.status(500).json({ error: "Failed to retrieve chart data" });
    }
  },
);

// ===== MOST PURCHASED ITEMS =====
router.get(
  "/most-purchased-items",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, ItemsQuery>,
    res: Response<APIResponse<PurchasedItemData[]>>,
  ) => {
    try {
      const { period = "month", location_id = "all" } = req.query;

      let dateThreshold = new Date(0); // alltime
      if (period === "month") dateThreshold = new Date(new Date().setDate(1));
      if (period === "year")
        dateThreshold = new Date(new Date().setMonth(0, 1));

      const topItems = await prisma.order_items.groupBy({
        by: ["menu_item_id"],
        where: {
          menu_item_id: { not: null },
          orders: {
            created_at: { gte: dateThreshold },
            ...(location_id !== "all"
              ? { location_id: parseInt(location_id) }
              : {}),
          },
        },
        _sum: { quantity: true, total_price: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 3,
      });

      const detailedItems = await Promise.all(
        topItems.map(async (item) => {
          const details = await prisma.menu_items.findUnique({
            where: { id: item.menu_item_id! },
            include: { base_items: true },
          });

          return {
            menu_item_id: item.menu_item_id!,
            name: details?.custom_name || details?.base_items.name || "Unknown",
            image_url:
              details?.custom_image_url ||
              details?.base_items.base_image_url ||
              null,
            quantity_sold: item._sum.quantity || 0,
            revenue: item._sum.total_price?.toNumber() || 0,
          };
        }),
      );

      return res.json({
        success: true,
        data: detailedItems as PurchasedItemData[],
      });
    } catch (err) {
      console.error("Top purchased items error:", err);
      return res.status(500).json({ error: "Failed to retrieve top items" });
    }
  },
);

// ===== LATEST TRANSACTIONS =====
router.get(
  "/latest-transactions",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{}, {}, {}, TransactionChartQuery>, res) => {
    try {
      const { type } = req.query;

      const transactions = await prisma.transactions.findMany({
        where: {
          ...(type === "purchases" ? { type: "order_payment" } : {}),
          ...(type === "topup" ? { type: "balance_topup" } : {}),
        },
        include: {
          users: true,
          orders: { select: { status: true } },
        },
        orderBy: { created_at: "desc" },
        take: 3,
      });

      const formatted = transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount.toNumber(),
        user_name: `${txn.users.first_name} ${txn.users.last_name}`,
        user_email: txn.users.email,
        order_id: txn.order_id,
        order_status: txn.orders?.status || null,
        created_at: txn.created_at,
      }));

      return res.json({
        success: true,
        data: { type: type || "all", transactions: formatted },
      });
    } catch (err) {
      console.error("Latest transactions error:", err);
      return res.status(500).json({ error: "Failed to retrieve transactions" });
    }
  },
);

// ===== TRANSACTIONS CHART (Hourly) =====
router.get(
  "/transactions-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, TransactionChartQuery>,
    res: Response<APIResponse<TransactionChartData>>,
  ) => {
    try {
      const { type = "all" } = req.query;

      // Фільтрація за типом транзакції
      let typeCondition = Prisma.empty;
      if (type === "purchases") {
        typeCondition = Prisma.sql`AND type = 'order_payment'`;
      } else if (type === "topup") {
        typeCondition = Prisma.sql`AND type = 'balance_topup'`;
      }

      // Отримуємо дані за останні 6 годин через Prisma Raw Query
      const chartResult = await prisma.$queryRaw<any[]>`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*)::int as count,
          SUM(amount)::float as total_amount
        FROM transactions
        WHERE created_at >= NOW() - INTERVAL '6 hours'
          ${typeCondition}
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour
      `;

      // Заповнюємо пропущені години нулями
      const now = new Date();
      const chartData = [];

      for (let i = 5; i >= 0; i--) {
        const hourDate = new Date(now);
        hourDate.setMinutes(0, 0, 0);
        hourDate.setHours(now.getHours() - i);

        const hourISO = hourDate.toISOString().slice(0, 13);

        const found = chartResult.find((row) => {
          const rowISO = new Date(row.hour).toISOString().slice(0, 13);
          return rowISO === hourISO;
        });

        chartData.push({
          hour: hourDate.toISOString(),
          hour_display: hourDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
          }),
          count: found ? found.count : 0,
          total_amount: found ? found.total_amount : 0,
        });
      }

      return res.json({
        success: true,
        data: {
          type,
          chart_data: chartData,
        },
      });
    } catch (err) {
      console.error("Transactions chart error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve transactions chart data" });
    }
  },
);

// ========================================
// APP PURCHASES CHART
// ========================================
router.get(
  "/purchases-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, DashboardQuery>,
    res: Response<APIResponse<ChartData>>,
  ) => {
    try {
      const { period = "7days" } = req.query;
      let result: PurchasesChartDataPoint[] = [];

      // Використовуємо $queryRaw для складних інтервалів
      if (period === "7days") {
        result = await prisma.$queryRaw<PurchasesChartDataPoint[]>`
          SELECT 
            DATE(created_at) as date, 
            COUNT(*)::int as count, 
            COALESCE(SUM(total_amount), 0)::float as revenue
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(created_at) ORDER BY date`;
      } else if (period === "1year") {
        result = await prisma.$queryRaw<PurchasesChartDataPoint[]>`
          SELECT 
            DATE_TRUNC('month', created_at) as date, 
            COUNT(*)::int as count, 
            COALESCE(SUM(total_amount), 0)::float as revenue
          FROM orders
          WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
          GROUP BY DATE_TRUNC('month', created_at) ORDER BY date`;
      } else {
        result = await prisma.$queryRaw<PurchasesChartDataPoint[]>`
          SELECT 
            DATE_TRUNC('year', created_at) as date, 
            COUNT(*)::int as count, 
            COALESCE(SUM(total_amount), 0)::float as revenue
          FROM orders
          GROUP BY DATE_TRUNC('year', created_at) ORDER BY date`;
      }

      return res.json({ success: true, data: { period, chart_data: result } });
    } catch (err) {
      console.error("Purchases chart error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve purchases chart" });
    }
  },
);

// ========================================
// TOP LOCATIONS
// ========================================
router.get(
  "/top-locations",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, LocationDashboardQuery>,
    res: Response<APIResponse<TopLocationsData>>,
  ) => {
    try {
      const { period = "month" } = req.query;

      let dateFilter: Prisma.ordersWhereInput = {};
      if (period === "month") {
        dateFilter = { created_at: { gte: new Date(new Date().setDate(1)) } };
      } else if (period === "year") {
        dateFilter = {
          created_at: { gte: new Date(new Date().setMonth(0, 1)) },
        };
      }

      // Отримуємо всі локації та агрегуємо дані замовлень через Prisma
      const locationsData = await prisma.locations.findMany({
        select: {
          id: true,
          name: true,
          orders: {
            where: dateFilter,
            select: {
              total_amount: true,
              _count: { select: { order_items: true } }, // Рахуємо позиції через зв'язок
            },
          },
        },
      });

      // Мапимо дані у формат TopLocationItem
      const allLocations: TopLocationItem[] = locationsData
        .map((loc) => {
          const revenue = loc.orders.reduce(
            (sum, o) => sum + o.total_amount.toNumber(),
            0,
          );
          const orderCount = loc.orders.length;
          // Тут items_sold рахується як кількість рядків в order_items (або можна додати SUM(quantity))
          const itemsSold = loc.orders.reduce(
            (sum, o) => sum + o._count.order_items,
            0,
          );

          return {
            id: loc.id,
            name: loc.name,
            revenue,
            items_sold: itemsSold,
            order_count: orderCount,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      const top3 = allLocations.slice(0, 3);
      const others = allLocations.slice(3);
      const totalRevenue = allLocations.reduce(
        (sum, loc) => sum + loc.revenue,
        0,
      );

      // Формуємо дані для Pie Chart
      const pieChart = top3.map((loc) => ({
        name: loc.name,
        revenue: loc.revenue,
        percentage:
          totalRevenue > 0 ? Math.round((loc.revenue / totalRevenue) * 100) : 0,
      }));

      if (others.length > 0) {
        const othersRev = others.reduce((sum, loc) => sum + loc.revenue, 0);
        pieChart.push({
          name: "Others",
          revenue: othersRev,
          percentage:
            totalRevenue > 0 ? Math.round((othersRev / totalRevenue) * 100) : 0,
        });
      }

      return res.json({
        success: true,
        data: { period, pie_chart: pieChart, top_3_list: top3 },
      });
    } catch (err) {
      console.error("Top locations error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve top locations" });
    }
  },
);

// ========================================
// QUICK STATS (New Users & Purchases)
// ========================================
const getQuickStats = async (model: "users" | "orders", roleCheck = false) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const yesterdayStart = new Date(
    new Date(todayStart).setDate(todayStart.getDate() - 1),
  );
  const sevenDaysAgo = new Date(
    new Date(todayStart).setDate(todayStart.getDate() - 7),
  );

  const whereBase = roleCheck ? { role: "customer" } : {};

  const [today, yesterday, last7Days] = await Promise.all([
    (prisma[model] as any).count({
      where: { ...whereBase, created_at: { gte: todayStart } },
    }),
    (prisma[model] as any).count({
      where: {
        ...whereBase,
        created_at: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    (prisma[model] as any).count({
      where: { ...whereBase, created_at: { gte: sevenDaysAgo } },
    }),
  ]);

  return {
    today,
    yesterday,
    seven_day_average: parseFloat((last7Days / 7).toFixed(1)),
  };
};

router.get(
  "/new-users-stats",
  authenticateToken,
  isAdminOrStaff,
  async (_req, res: Response<APIResponse<QuickStats>>) => {
    try {
      const data = await getQuickStats("users", true);
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve user stats" });
    }
  },
);

router.get(
  "/purchases-stats",
  authenticateToken,
  isAdminOrStaff,
  async (_req, res: Response<APIResponse<QuickStats>>) => {
    try {
      const data = await getQuickStats("orders");
      return res.json({ success: true, data });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve purchase stats" });
    }
  },
);

export default router;
