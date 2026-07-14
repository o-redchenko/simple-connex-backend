import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import { AuthRequest, TopUpBody } from "@/types";

const router = Router();

// ========================================
// POST Top up balance
// ========================================
router.post(
  "/topup",
  authenticateToken,
  async (req: AuthRequest<{}, {}, TopUpBody>, res: Response) => {
    try {
      const { amount, payment_method } = req.body;
      const user_id = req.user?.userId;

      if (!user_id) return res.status(401).json({ error: "Unauthorized" });
      if (!amount || amount <= 0)
        return res.status(400).json({ error: "Amount > 0 required" });
      if (amount > 1000)
        return res.status(400).json({ error: "Max top-up is $1000" });

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.users.findUnique({
          where: { id: user_id },
          select: { balance: true },
        });

        if (!user) throw new Error("User not found");

        const currentBalance = Number(user.balance);
        const newBalance = currentBalance + amount;

        // Створюємо запис транзакції
        await tx.transactions.create({
          data: {
            user_id,
            type: "balance_topup",
            amount,
            balance_before: currentBalance,
            balance_after: newBalance,
            status: "completed",
            payment_method: payment_method || "card",
            notes: `Balance top-up of $${amount}`,
          },
        });

        // Оновлюємо баланс користувача
        await tx.users.update({
          where: { id: user_id },
          data: { balance: newBalance },
        });

        return {
          previous_balance: currentBalance,
          amount_added: amount,
          new_balance: newBalance,
        };
      });

      return res.status(201).json({
        success: true,
        message: "Balance topped up successfully",
        data: result,
      });
    } catch (err: any) {
      console.error("Top-up error:", err);
      return res.status(500).json({ error: err.message || "Failed to top up" });
    }
  },
);

// ========================================
// GET My Transactions
// ========================================
router.get(
  "/my-transactions",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const transactions = await prisma.transactions.findMany({
        where: { user_id: req.user?.userId },
        include: {
          orders: { select: { status: true } },
        },
        orderBy: { created_at: "desc" },
      });

      const data = transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balance_before: Number(t.balance_before),
        balance_after: Number(t.balance_after),
        order_status: t.orders?.status,
      }));

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve transactions" });
    }
  },
);

// ========================================
// GET My Balance
// ========================================
router.get(
  "/balance",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.user?.userId },
        select: { balance: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        success: true,
        data: { balance: Number(user.balance) },
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve balance" });
    }
  },
);

// ========================================
// GET All Transactions (Admin/Staff)
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<
      {},
      {},
      {},
      {
        page?: string;
        limit?: string;
        user_id?: string;
        type?: string;
        start_date?: string;
        end_date?: string;
      }
    >,
    res: Response,
  ) => {
    try {
      const page = parseInt(req.query.page || "1");
      const limit = parseInt(req.query.limit || "50");
      const { user_id, type, start_date, end_date } = req.query;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (user_id) where.user_id = parseInt(user_id);
      if (type) where.type = type;
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at.gte = new Date(start_date);
        if (end_date) where.created_at.lte = new Date(end_date);
      }

      const [transactions, totalCount] = await Promise.all([
        prisma.transactions.findMany({
          where,
          include: {
            users: {
              select: { first_name: true, last_name: true, email: true },
            },
          },
          orderBy: { created_at: "desc" },
          take: limit,
          skip: skip,
        }),
        prisma.transactions.count({ where }),
      ]);

      const data = transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balance_after: Number(t.balance_after),
        balance_before: Number(t.balance_before),
        first_name: t.users?.first_name || "",
        last_name: t.users?.last_name || "",
        email: t.users?.email || "",
      }));

      return res.json({
        success: true,
        data,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      console.error("Get transactions error:", err);
      return res.status(500).json({ error: "Failed to retrieve transactions" });
    }
  },
);

export default router;
