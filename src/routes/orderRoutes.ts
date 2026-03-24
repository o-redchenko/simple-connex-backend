import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateOrderBody,
  Order,
  ORDER_STATUS_VALUES,
  OrderDetails,
  OrdersQuery,
  UpdateOrderStatusBody,
} from "@/types";
import { getRowOrNotFound } from "@/utils/response";
import { isValidOrderStatus } from "@/utils/validation";

const router = express.Router();

// Create order with variations and modifiers
router.post(
  "/",
  authenticateToken,
  async (
    req: AuthRequest<{}, {}, CreateOrderBody>,
    res: Response<APIResponse<{ order: Order; new_balance: number }>>,
  ) => {
    const client = await pool.connect();

    try {
      const { location_id, items, notes } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ error: "Order must contain at least one item" });
      }

      await client.query("BEGIN");

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, location_id, status, total_amount, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
        [userId, location_id, "pending", 0, notes],
      );
      const orderId = orderResult.rows[0].id;

      let orderTotal = 0;

      // Process each item
      for (const item of items) {
        const { menu_item_id, quantity, variation_id, modifiers } = item;

        // ==================== GET MENU ITEM DATA (for snapshot) ====================
        const menuItemResult = await client.query(
          `SELECT 
          mi.id,
          COALESCE(mi.custom_name, bi.name) as name,
          COALESCE(mi.custom_description, bi.description) as description,
          COALESCE(mi.custom_price, bi.base_price) as base_price
         FROM menu_items mi
         JOIN base_items bi ON mi.base_item_id = bi.id
         WHERE mi.id = $1 AND mi.is_available = true`,
          [menu_item_id],
        );

        if (menuItemResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `Menu item ${menu_item_id} not found or unavailable`,
          });
        }

        const menuItem = menuItemResult.rows[0];
        const basePrice = parseFloat(menuItem.base_price);
        let itemPrice = basePrice;

        // ==================== GET VARIATION DATA (for snapshot) ====================
        const variationResult = await client.query(
          `SELECT 
          miv.id,
          v.name,
          miv.price_adjustment
         FROM menu_item_variations miv
         JOIN variations v ON miv.variation_id = v.id
         WHERE miv.id = $1 
           AND miv.menu_item_id = $2 
           AND miv.is_available = true`,
          [variation_id, menu_item_id],
        );

        if (variationResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `Variation ${variation_id} not found for item ${menu_item_id}`,
          });
        }

        const variation = variationResult.rows[0];
        const variationAdjustment = parseFloat(variation.price_adjustment);
        itemPrice += variationAdjustment;

        // ==================== INSERT ORDER ITEM (with snapshot) ====================
        const orderItemResult = await client.query(
          `INSERT INTO order_items (
          order_id, 
          menu_item_id, 
          item_name, 
          item_description, 
          quantity, 
          base_price, 
          total_price
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
          [
            orderId,
            menu_item_id,
            menuItem.name, // Snapshot name
            menuItem.description, // Snapshot description
            quantity,
            basePrice,
            0, // Will update after modifiers
          ],
        );
        const orderItemId = orderItemResult.rows[0].id;

        // ==================== INSERT VARIATION (with snapshot) ====================
        await client.query(
          `INSERT INTO order_item_variations (
          order_item_id, 
          variation_id, 
          variation_name, 
          price_adjustment
        )
         VALUES ($1, $2, $3, $4)`,
          [
            orderItemId,
            variation.id,
            variation.name, // Snapshot variation name
            variationAdjustment,
          ],
        );

        // ==================== INSERT MODIFIERS (with snapshot) ====================
        if (modifiers && modifiers.length > 0) {
          for (const mod of modifiers) {
            const modResult = await client.query(
              `SELECT 
              mim.id,
              m.name,
              mim.price
             FROM menu_item_modifiers mim
             JOIN modifiers m ON mim.modifier_id = m.id
             WHERE mim.modifier_id = $1 
               AND mim.menu_item_id = $2 
               AND mim.is_available = true`,
              [mod.modifier_id, menu_item_id],
            );

            if (modResult.rows.length === 0) continue;

            const modifier = modResult.rows[0];
            const modPrice = parseFloat(modifier.price);
            itemPrice += modPrice * mod.quantity;

            await client.query(
              `INSERT INTO order_item_modifiers (
              order_item_id, 
              modifier_id, 
              modifier_name, 
              price, 
              quantity
            )
             VALUES ($1, $2, $3, $4, $5)`,
              [
                orderItemId,
                mod.modifier_id,
                modifier.name, // Snapshot modifier name
                modPrice,
                mod.quantity,
              ],
            );
          }
        }

        // ==================== UPDATE ITEM TOTAL ====================
        const itemTotal = itemPrice * quantity;
        await client.query(
          `UPDATE order_items SET total_price = $1 WHERE id = $2`,
          [itemTotal, orderItemId],
        );

        orderTotal += itemTotal;
      }

      // Update order total
      await client.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [
        orderTotal,
        orderId,
      ]);

      // Create transaction
      const balanceResult = await client.query(
        `SELECT balance FROM users WHERE id = $1`,
        [userId],
      );
      const currentBalance = parseFloat(balanceResult.rows[0].balance);

      if (currentBalance < orderTotal) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Insufficient balance",
        });
      }

      const newBalance = currentBalance - orderTotal;

      await client.query(
        `INSERT INTO transactions (
        user_id, 
        order_id, 
        type, 
        amount, 
        balance_before, 
        balance_after, 
        status, 
        payment_method
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          orderId,
          "order_payment",
          orderTotal,
          currentBalance,
          newBalance,
          "completed",
          "balance",
        ],
      );

      await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [
        newBalance,
        userId,
      ]);

      await client.query("COMMIT");

      // Get created order
      const createdOrder = await pool.query(
        `SELECT 
        orders.*,
        locations.name as location_name
       FROM orders
       JOIN locations ON orders.location_id = locations.id
       WHERE orders.id = $1`,
        [orderId],
      );

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: createdOrder.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create order error:", err);
      return res.status(500).json({ error: "Failed to create order" });
    } finally {
      client.release();
    }
  },
);

// Get user's own orders
router.get(
  "/my-orders",
  authenticateToken,
  async (req: AuthRequest, res: Response<APIResponse<Order[]>>) => {
    try {
      const user_id = req.user?.userId;

      if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await pool.query<Order>(
        `SELECT 
        orders.id,
        orders.status,
        orders.total_amount,
        orders.notes,
        orders.created_at,
        locations.name as location_name,
        COUNT(order_items.id) as item_count
       FROM orders
       LEFT JOIN locations ON orders.location_id = locations.id
       LEFT JOIN order_items ON orders.id = order_items.order_id
       WHERE orders.user_id = $1
       GROUP BY orders.id, locations.name
       ORDER BY orders.created_at DESC`,
        [user_id],
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get my orders error:", err);
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  },
);

// Get single order with full details
router.get(
  "/:id",
  authenticateToken,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<OrderDetails>>,
  ) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      // Get order
      const orderResult = await pool.query(
        `SELECT 
        orders.*,
        locations.name as location_name,
        COALESCE(users.first_name || ' ' || users.last_name, users.email) as customer_name
       FROM orders
       JOIN locations ON orders.location_id = locations.id
       JOIN users ON orders.user_id = users.id
       WHERE orders.id = $1`,
        [id],
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      const order = orderResult.rows[0];

      // Check access
      if (req.user?.role === "customer" && order.user_id !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get order items (using snapshot data!)
      const itemsResult = await pool.query(
        `SELECT 
        oi.id,
        oi.menu_item_id,
        oi.item_name as name,              -- Snapshot
        oi.item_description as description, -- Snapshot
        oi.quantity,
        oi.base_price,
        oi.total_price,
        -- Variation (snapshot)
        json_build_object(
          'id', oiv.id,
          'variation_id', oiv.variation_id,
          'name', oiv.variation_name,      -- Snapshot
          'price_adjustment', oiv.price_adjustment
        ) as variation,
        -- Modifiers (snapshot)
        COALESCE(
          json_agg(
            json_build_object(
              'id', oim.id,
              'modifier_id', oim.modifier_id,
              'name', oim.modifier_name,   -- Snapshot
              'price', oim.price,
              'quantity', oim.quantity
            )
          ) FILTER (WHERE oim.id IS NOT NULL),
          '[]'
        ) as modifiers
       FROM order_items oi
       LEFT JOIN order_item_variations oiv ON oi.id = oiv.order_item_id
       LEFT JOIN order_item_modifiers oim ON oi.id = oim.order_item_id
       WHERE oi.order_id = $1
       GROUP BY oi.id, oiv.id
       ORDER BY oi.id`,
        [id],
      );

      return res.json({
        success: true,
        data: {
          ...order,
          items: itemsResult.rows,
        },
      });
    } catch (err) {
      console.error("Get order error:", err);
      return res.status(500).json({ error: "Failed to retrieve order" });
    }
  },
);

// Get all orders (admin/staff)
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, {}, OrdersQuery>,
    res: Response<APIResponse<Order[]>>,
  ) => {
    try {
      const { status, location_id } = req.query;

      let query = `
      SELECT 
        orders.id,
        orders.status,
        orders.total_amount,
        orders.created_at,
        users.email as customer_email,
        users.first_name || ' ' || users.last_name as customer_name,
        locations.name as location_name,
        COUNT(order_items.id) as item_count
      FROM orders
      LEFT JOIN users ON orders.user_id = users.id
      LEFT JOIN locations ON orders.location_id = locations.id
      LEFT JOIN order_items ON orders.id = order_items.order_id
      WHERE 1=1
    `;

      const params = [];
      let paramCount = 1;

      if (status) {
        query += ` AND orders.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (location_id) {
        query += ` AND orders.location_id = $${paramCount}`;
        params.push(location_id);
        paramCount++;
      }

      query += `
      GROUP BY orders.id, users.email, users.first_name, users.last_name, locations.name
      ORDER BY orders.created_at DESC
    `;

      const result = await pool.query<Order>(query, params);

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get all orders error:", err);
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  },
);

// Update order status (staff/admin)
router.put(
  "/:id/status",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateOrderStatusBody>,
    res: Response<APIResponse<Order>>,
  ) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !isValidOrderStatus(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${ORDER_STATUS_VALUES.join(", ")}`,
        });
      }

      const result = await pool.query<Order>(
        "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
        [status, id],
      );

      const order = getRowOrNotFound(result.rows, res, "Order not found");

      if (!order) {
        throw new Error("Order not found");
      }

      return res.json({
        success: true,
        message: "Order status updated",
        data: order,
      });
    } catch (err) {
      console.error("Update order status error:", err);
      return res.status(500).json({ error: "Failed to update order status" });
    }
  },
);

export default router;
