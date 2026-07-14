import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import { AuthRequest, CreateOrderBody, UpdateOrderStatusBody } from "@/types";
import { isValidOrderStatus } from "@/utils/validation";

const router = Router();

// ========================================
// CREATE Order (Transaction with Balance)
// ========================================
router.post(
  "/",
  authenticateToken,
  async (req: AuthRequest<{}, {}, CreateOrderBody>, res: Response) => {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const { location_id, items, notes } = req.body;
    if (!items?.length)
      return res.status(400).json({ error: "Order is empty" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Перевірка балансу користувача
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { balance: true },
        });

        if (!user) throw new Error("User not found");

        let orderTotal = 0;
        const orderItemsToCreate = [];

        // 2. Обробка кожної позиції
        for (const item of items) {
          // Отримуємо дані страви (snapshot)
          const menuItem = await tx.menu_items.findUnique({
            where: { id: item.menu_item_id },
            include: { base_items: true },
          });

          if (!menuItem || !menuItem.is_available) {
            throw new Error(`Item ${item.menu_item_id} is unavailable`);
          }

          const basePrice = Number(
            menuItem.custom_price || menuItem.base_items.base_price,
          );
          let currentItemPrice = basePrice;

          // Варіація (snapshot)
          const variation = await tx.menu_item_variations.findFirst({
            where: { id: item.variation_id, menu_item_id: item.menu_item_id },
            include: { variations: true },
          });

          if (!variation) throw new Error("Invalid variation");
          const varAdjustment = Number(variation.price_adjustment);
          currentItemPrice += varAdjustment;

          // Модифікатори (snapshot)
          const modifiersToCreate = [];
          if (item.modifiers?.length) {
            for (const mod of item.modifiers) {
              const menuMod = await tx.menu_item_modifiers.findFirst({
                where: {
                  modifier_id: mod.modifier_id,
                  menu_item_id: item.menu_item_id,
                },
                include: { modifiers: true },
              });

              if (menuMod && menuMod.is_available) {
                const modPrice = Number(menuMod.price);
                currentItemPrice += modPrice * mod.quantity;
                modifiersToCreate.push({
                  modifier_id: mod.modifier_id,
                  modifier_name: menuMod.modifiers.name,
                  price: modPrice,
                  quantity: mod.quantity,
                });
              }
            }
          }

          const itemTotal = currentItemPrice * item.quantity;
          orderTotal += itemTotal;

          orderItemsToCreate.push({
            menu_item_id: item.menu_item_id,
            item_name: menuItem.custom_name || menuItem.base_items.name,
            item_description:
              menuItem.custom_description || menuItem.base_items.description,
            quantity: item.quantity,
            base_price: basePrice,
            total_price: itemTotal,
            order_item_variations: {
              create: {
                variation_id: variation.id,
                variation_name: variation.variations.name,
                price_adjustment: varAdjustment,
              },
            },
            order_item_modifiers: {
              create: modifiersToCreate,
            },
          });
        }

        // 3. Перевірка чи вистачає грошей
        const currentBalance = Number(user.balance);
        if (currentBalance < orderTotal)
          throw new Error("Insufficient balance");

        const newBalance = currentBalance - orderTotal;

        // 4. Створення замовлення та транзакції
        const order = await tx.orders.create({
          data: {
            user_id: userId,
            location_id,
            status: "pending",
            total_amount: orderTotal,
            notes,
            order_items: {
              create: orderItemsToCreate,
            },
          },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            order_id: order.id,
            type: "order_payment",
            amount: orderTotal,
            balance_before: currentBalance,
            balance_after: newBalance,
            status: "completed",
            payment_method: "balance",
          },
        });

        await tx.users.update({
          where: { id: userId },
          data: { balance: newBalance },
        });

        return { order, newBalance };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error("Order error:", err);
      return res
        .status(400)
        .json({ error: err.message || "Failed to create order" });
    }
  },
);

// ========================================
// GET My Orders
// ========================================
router.get(
  "/my-orders",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const orders = await prisma.orders.findMany({
        where: { user_id: req.user?.userId },
        include: {
          locations: { select: { name: true } },
          _count: { select: { order_items: true } },
        },
        orderBy: { created_at: "desc" },
      });

      const data = orders.map((o) => ({
        ...o,
        location_name: o.locations?.name,
        item_count: o._count.order_items,
        total_amount: Number(o.total_amount),
      }));

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve orders" });
    }
  },
);

// ========================================
// GET Order Details
// ========================================
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const order = await prisma.orders.findUnique({
        where: { id },
        include: {
          locations: { select: { name: true } },
          users: { select: { first_name: true, last_name: true, email: true } },
          order_items: {
            include: {
              order_item_variations: true,
              order_item_modifiers: true,
            },
          },
        },
      });

      if (!order) return res.status(404).json({ error: "Order not found" });

      // Доступ: тільки власник або стафф
      if (req.user?.role === "customer" && order.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = {
        ...order,
        location_name: order.locations?.name,
        customer_name:
          `${order.users.first_name} ${order.users.last_name}`.trim() ||
          order.users.email,
        total_amount: Number(order.total_amount),
        items: order.order_items.map((oi) => ({
          ...oi,
          base_price: Number(oi.base_price),
          total_price: Number(oi.total_price),
          variation: oi.order_item_variations[0], // В нас 1 варіація на ітем
          modifiers: oi.order_item_modifiers,
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve order" });
    }
  },
);

// ========================================
// UPDATE Order Status
// ========================================
router.put(
  "/:id/status",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateOrderStatusBody>,
    res: Response,
  ) => {
    try {
      const { status } = req.body;
      if (!isValidOrderStatus(status)) throw new Error("Invalid status");

      const updated = await prisma.orders.update({
        where: { id: parseInt(req.params.id) },
        data: { status },
      });

      return res.json({ success: true, data: updated });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  },
);

export default router;
