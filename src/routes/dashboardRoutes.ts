import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  ChartData,
  ChartDataPoint,
  DashboardQuery,
  ItemsQuery,
  LatestTransactionItem,
  LocationDashboardQuery,
  OverviewStats,
  PurchasedItemData,
  QuickStats,
  TopLocationItem,
  TopLocationsData,
  TransactionChartData,
  TransactionChartQuery,
} from "@/types";

const router = express.Router();

// ===== OVERVIEW CARDS =====

// Get overview statistics (Total Users, Total Purchases, New Users Today)
router.get(
  "/overview",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<OverviewStats>>) => {
    try {
      // Total users (customers only)
      const totalUsersResult = await pool.query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'customer'",
      );

      // Total app purchases
      const totalPurchasesResult = await pool.query(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders",
      );

      // New users today
      const newUsersTodayResult = await pool.query(
        `SELECT COUNT(*) as total 
       FROM users 
       WHERE role = 'customer' 
         AND DATE(created_at) = CURRENT_DATE`,
      );

      return res.json({
        success: true,
        data: {
          total_users: parseInt(totalUsersResult.rows[0].total),
          total_purchases: parseInt(totalPurchasesResult.rows[0].total),
          new_users_today: parseInt(newUsersTodayResult.rows[0].total),
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

// Get new users chart data
router.get(
  "/new-users-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, DashboardQuery>,
    res: Response<APIResponse<ChartData>>,
  ) => {
    try {
      const { period } = req.query; // '1month', '1year', 'alltime'

      let query;

      switch (period) {
        case "7days":
          // Daily data for current month
          query = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
          FROM users
          WHERE role = 'customer'
            AND created_at >= NOW() - INTERVAL '6 days'
            AND created_at < CURRENT_DATE + INTERVAL '1 day'
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
          break;

        case "1year":
          // Monthly data for current year
          query = `
          SELECT 
            DATE_TRUNC('month', created_at) as date,
            COUNT(*) as count
          FROM users
          WHERE role = 'customer'
            AND DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY date
        `;
          break;

        case "alltime":
          // Yearly data for all time
          query = `
          SELECT 
            DATE_TRUNC('year', created_at) as date,
            COUNT(*) as count
          FROM users
          WHERE role = 'customer'
          GROUP BY DATE_TRUNC('year', created_at)
          ORDER BY date
        `;
          break;

        default:
          return res
            .status(400)
            .json({ error: "Invalid period. Use: 1month, 1year, or alltime" });
      }

      const result = await pool.query<ChartDataPoint>(query);

      return res.json({
        success: true,
        data: {
          period: period,
          chart_data: result.rows,
        },
      });
    } catch (err) {
      console.error("New users chart error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve new users chart data" });
    }
  },
);

// ===== APP PURCHASES CHART =====

// Get app purchases chart data (same filters as new users)
router.get(
  "/purchases-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, DashboardQuery>,
    res: Response<APIResponse<ChartData>>,
  ) => {
    try {
      const { period } = req.query; // '1month', '1year', 'alltime'

      let query;

      switch (period) {
        case "7days":
          // Daily data for current month
          query = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as count,
            SUM(total_amount) as revenue
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
          break;

        case "1year":
          // Monthly data for current year
          query = `
          SELECT 
            DATE_TRUNC('month', created_at) as date,
            COUNT(*) as count,
            SUM(total_amount) as revenue
          FROM orders
          WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY date
        `;
          break;

        case "alltime":
          // Yearly data for all time
          query = `
          SELECT 
            DATE_TRUNC('year', created_at) as date,
            COUNT(*) as count,
            SUM(total_amount) as revenue
          FROM orders
          GROUP BY DATE_TRUNC('year', created_at)
          ORDER BY date
        `;
          break;

        default:
          return res
            .status(400)
            .json({ error: "Invalid period. Use: 1month, 1year, or alltime" });
      }

      const result = await pool.query(query);

      return res.json({
        success: true,
        data: {
          period: period,
          chart_data: result.rows,
        },
      });
    } catch (err) {
      console.error("Purchases chart error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve purchases chart data" });
    }
  },
);

// ===== TOP LOCATIONS =====

// Get top locations (pie chart data + list)
router.get(
  "/top-locations",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, LocationDashboardQuery>,
    res: Response<APIResponse<TopLocationsData>>,
  ) => {
    try {
      const { period } = req.query; // 'month', 'year', 'alltime'

      let dateFilter = "";
      switch (period) {
        case "month":
          dateFilter =
            "AND DATE_TRUNC('month', orders.created_at) = DATE_TRUNC('month', CURRENT_DATE)";
          break;
        case "year":
          dateFilter =
            "AND DATE_TRUNC('year', orders.created_at) = DATE_TRUNC('year', CURRENT_DATE)";
          break;
        case "alltime":
          dateFilter = "";
          break;
        default:
          return res
            .status(400)
            .json({ error: "Invalid period. Use: month, year, or alltime" });
      }

      // Get all locations with their stats
      const allLocationsQuery = `
      SELECT 
        locations.id,
        locations.name,
        COUNT(orders.id) as order_count,
        SUM(orders.total_amount) as revenue,
        SUM((
          SELECT SUM(quantity) 
          FROM order_items 
          WHERE order_items.order_id = orders.id
        )) as items_sold
      FROM locations
      LEFT JOIN orders ON locations.id = orders.location_id
      WHERE 1=1 ${dateFilter}
      GROUP BY locations.id, locations.name
      ORDER BY revenue DESC
    `;

      const allLocations = await pool.query<TopLocationItem>(allLocationsQuery);

      // Prepare data for pie chart and list
      let top3: TopLocationItem[], others: TopLocationItem[];

      if (allLocations.rows.length > 3) {
        top3 = allLocations.rows.slice(0, 3);
        others = allLocations.rows.slice(3);
      } else {
        top3 = allLocations.rows;
        others = [];
      }

      // Calculate "Others" total
      const othersTotal =
        others.length > 0
          ? others.reduce((sum, loc) => sum + (loc.revenue || 0), 0)
          : 0;
      // const othersItemsSold = others.reduce(
      //   (sum, loc) => sum + (loc.items_sold || 0),
      //   0,
      // );

      // Pie chart data
      const pieChartData = [
        ...top3.map((loc) => ({
          name: loc.name,
          revenue: loc.revenue || 0,
          percentage: 0, // Will calculate below
        })),
      ];

      if (othersTotal > 0) {
        pieChartData.push({
          name: "Others",
          revenue: othersTotal,
          percentage: 0,
        });
      }

      // Calculate percentages
      const totalRevenue = pieChartData.reduce(
        (sum, item) => sum + item.revenue,
        0,
      );
      pieChartData.forEach((item) => {
        item.percentage =
          totalRevenue > 0
            ? Math.round((item.revenue / totalRevenue) * 100)
            : 0;
      });

      // Top 3 list data
      const topLocationsList = top3.map((loc) => ({
        id: loc.id,
        name: loc.name,
        revenue: loc.revenue || 0,
        items_sold: loc.items_sold || 0,
        order_count: loc.order_count || 0,
      }));

      return res.json({
        success: true,
        data: {
          period: period,
          pie_chart: pieChartData,
          top_3_list: topLocationsList,
        },
      });
    } catch (err) {
      console.error("Top locations error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve top locations data" });
    }
  },
);

// ===== MOST PURCHASED ITEMS =====

// Get most purchased items (filtered by period and location)
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

      // Validate period
      if (!["month", "year", "alltime"].includes(period as string)) {
        return res.status(400).json({
          error: "Invalid period. Use: month, year, or alltime",
        });
      }

      // Build date filter
      let dateFilter = "";
      switch (period) {
        case "month":
          dateFilter = `AND orders.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
          break;
        case "year":
          dateFilter = `AND orders.created_at >= DATE_TRUNC('year', CURRENT_DATE)`;
          break;
        case "alltime":
          dateFilter = "";
          break;
      }

      // Build location filter
      const locationFilter =
        location_id !== "all" ? `AND orders.location_id = $1` : "";

      const queryParams = location_id !== "all" ? [location_id] : [];

      // Query top 3 items
      const query = `
      SELECT 
        COALESCE(menu_items.custom_name, base_items.name) as name,
        COALESCE(menu_items.custom_image_url, base_items.base_image_url) as image_url,
        SUM(order_items.quantity) as quantity_sold,
        SUM(order_items.total_price) as revenue,
        menu_items.id as menu_item_id
      FROM order_items
      JOIN orders ON order_items.order_id = orders.id
      LEFT JOIN menu_items ON order_items.menu_item_id = menu_items.id
      LEFT JOIN base_items ON menu_items.base_item_id = base_items.id
      WHERE order_items.menu_item_id IS NOT NULL
        ${dateFilter}
        ${locationFilter}
      GROUP BY 
        menu_items.id, 
        base_items.id,
        menu_items.custom_name,
        menu_items.custom_image_url,
        base_items.name,
        base_items.base_image_url
      ORDER BY quantity_sold DESC
      LIMIT 3
    `;

      const result = await pool.query(query, queryParams);

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Top purchased items error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve top purchased items" });
    }
  },
);

// ===== LATEST TRANSACTIONS =====

// Get latest transactions chart (last 6 hours, bar chart)
router.get(
  "/transactions-chart",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, TransactionChartQuery>,
    res: Response<APIResponse<TransactionChartData>>,
  ) => {
    try {
      const { type } = req.query; // 'purchases', 'topup', 'all'

      let typeFilter = "";
      if (type === "purchases") {
        typeFilter = "AND type = 'order_payment'";
      } else if (type === "topup") {
        typeFilter = "AND type = 'balance_topup'";
      }
      // 'all' means no filter

      // Get hourly data for last 6 hours
      const chartQuery = `
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '6 hours'
        ${typeFilter}
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour
    `;

      const chartResult = await pool.query(chartQuery);

      // Fill in missing hours with zero values
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const chartData = [];

      for (let i = 0; i < 6; i++) {
        const hour = new Date(sixHoursAgo.getTime() + i * 60 * 60 * 1000);
        const hourString = hour.toISOString().slice(0, 13) + ":00:00";

        const found = chartResult.rows.find((row) => {
          const rowHour =
            new Date(row.hour).toISOString().slice(0, 13) + ":00:00";
          return rowHour === hourString;
        });

        chartData.push({
          hour: hour.toISOString(),
          hour_display: hour.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
          }),
          count: found ? parseInt(found.count) : 0,
          total_amount: found ? parseFloat(found.total_amount) : 0,
        });
      }

      return res.json({
        success: true,
        data: {
          type: type || "all",
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

// Get latest 3 transactions list
router.get(
  "/latest-transactions",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{}, {}, {}, TransactionChartQuery>, res) => {
    try {
      const { type } = req.query; // 'purchases', 'topup', 'all'

      let typeFilter = "";
      if (type === "purchases") {
        typeFilter = "AND transactions.type = 'order_payment'";
      } else if (type === "topup") {
        typeFilter = "AND transactions.type = 'balance_topup'";
      }

      const query = `
      SELECT 
        transactions.id,
        transactions.type,
        transactions.amount,
        transactions.created_at,
        users.email as user_email,
        users.first_name || ' ' || users.last_name as user_name,
        orders.id as order_id,
        orders.status as order_status
      FROM transactions
      JOIN users ON transactions.user_id = users.id
      LEFT JOIN orders ON transactions.order_id = orders.id
      WHERE 1=1 ${typeFilter}
      ORDER BY transactions.created_at DESC
      LIMIT 3
    `;

      const result = await pool.query<LatestTransactionItem>(query);

      const transactions = result.rows.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        user_name: txn.user_name,
        user_email: txn.user_email,
        order_id: txn.order_id,
        order_status: txn.order_status,
        created_at: txn.created_at,
      }));

      return res.json({
        success: true,
        data: {
          type: type || "all",
          transactions: transactions,
        },
      });
    } catch (err) {
      console.error("Latest transactions error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve latest transactions" });
    }
  },
);

// ========================================
// NEW USERS QUICK STATS (Today, Yesterday, 7-day Average)
// ========================================
router.get(
  "/new-users-stats",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<QuickStats>>) => {
    try {
      // Today
      const todayResult = await pool.query(
        `SELECT COUNT(*) as count
       FROM users
       WHERE role = 'customer'
         AND DATE(created_at) = CURRENT_DATE`,
      );

      // Yesterday
      const yesterdayResult = await pool.query(
        `SELECT COUNT(*) as count
       FROM users
       WHERE role = 'customer'
         AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`,
      );

      // 7-day average
      const sevenDayResult = await pool.query(
        `SELECT ROUND(COUNT(*)::numeric / 7, 1) as avg
       FROM users
       WHERE role = 'customer'
         AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      );

      res.json({
        success: true,
        data: {
          today: parseInt(todayResult.rows[0].count),
          yesterday: parseInt(yesterdayResult.rows[0].count),
          seven_day_average: parseFloat(sevenDayResult.rows[0].avg || 0),
        },
      });
    } catch (err) {
      console.error("New users stats error:", err);
      res.status(500).json({ error: "Failed to retrieve new users stats" });
    }
  },
);

// ========================================
// PURCHASES QUICK STATS (Today, Yesterday, 7-day Average)
// ========================================
router.get(
  "/purchases-stats",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<QuickStats>>) => {
    try {
      // Today
      const todayResult = await pool.query(
        `SELECT COUNT(*) as count
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE`,
      );

      // Yesterday
      const yesterdayResult = await pool.query(
        `SELECT COUNT(*) as count
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`,
      );

      // 7-day average
      const sevenDayResult = await pool.query(
        `SELECT ROUND(COUNT(*)::numeric / 7, 1) as avg
       FROM orders
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      );

      res.json({
        success: true,
        data: {
          today: parseInt(todayResult.rows[0].count),
          yesterday: parseInt(yesterdayResult.rows[0].count),
          seven_day_average: parseFloat(sevenDayResult.rows[0].avg || 0),
        },
      });
    } catch (err) {
      console.error("Purchases stats error:", err);
      res.status(500).json({ error: "Failed to retrieve purchases stats" });
    }
  },
);

export default router;
