import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdmin } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  SafeUser,
  TopUpBody,
  Transaction,
  TransactionsQuery,
} from "@/types";

const router = express.Router();

// Top up balance
router.post(
  "/topup",
  authenticateToken,
  async (
    req: AuthRequest<{}, {}, TopUpBody>,
    res: Response<
      APIResponse<{
        previous_balance: number;
        amount_added: number;
        new_balance: number;
      }>
    >,
  ) => {
    const client = await pool.connect();

    try {
      const { amount, payment_method } = req.body;
      const user_id = req.user?.userId;

      if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Amount must be greater than 0" });
      }

      if (amount > 1000) {
        return res
          .status(400)
          .json({ error: "Maximum top-up amount is $1000" });
      }

      await client.query("BEGIN");

      // Get current balance
      const userResult = await client.query<{ balance: number }>(
        "SELECT balance FROM users WHERE id = $1",
        [user_id],
      );

      const userBalance = userResult.rows[0];

      if (!userBalance) {
        throw new Error("User not found");
      }

      const currentBalance: number = userBalance.balance;
      const newBalance = currentBalance + amount;

      // Create transaction
      await client.query<Transaction>(
        `INSERT INTO transactions (
        user_id, type, amount, balance_before, balance_after, 
        status, payment_method, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user_id,
          "balance_topup",
          amount,
          currentBalance,
          newBalance,
          "completed",
          payment_method || "card",
          `Balance top-up of $${amount}`,
        ],
      );

      // Update user balance
      await client.query<SafeUser>(
        "UPDATE users SET balance = $1 WHERE id = $2",
        [newBalance, user_id],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Balance topped up successfully",
        data: {
          previous_balance: currentBalance,
          amount_added: amount,
          new_balance: newBalance,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Top-up error:", err);
      return res.status(500).json({ error: "Failed to top up balance" });
    } finally {
      client.release();
    }
  },
);

// Get user's transaction history
router.get(
  "/my-transactions",
  authenticateToken,
  async (req: AuthRequest, res: Response<APIResponse<Transaction[]>>) => {
    try {
      const user_id = req.user?.userId;

      if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await pool.query<Transaction>(
        `SELECT 
        transactions.*,
        orders.status as order_status
       FROM transactions
       LEFT JOIN orders ON transactions.order_id = orders.id
       WHERE transactions.user_id = $1
       ORDER BY transactions.created_at DESC`,
        [user_id],
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get transactions error:", err);
      return res.status(500).json({ error: "Failed to retrieve transactions" });
    }
  },
);

// Get user's current balance
router.get(
  "/balance",
  authenticateToken,
  async (req: AuthRequest, res: Response<APIResponse<{ balance: number }>>) => {
    try {
      const user_id = req.user?.userId;

      if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await pool.query<{ balance: number }>(
        "SELECT balance FROM users WHERE id = $1",
        [user_id],
      );

      const userBalance = result.rows[0];

      if (!userBalance) {
        throw new Error("User not found");
      }

      return res.json({
        success: true,
        data: {
          balance: userBalance.balance,
        },
      });
    } catch (err) {
      console.error("Get balance error:", err);
      return res.status(500).json({ error: "Failed to retrieve balance" });
    }
  },
);

// Get all transactions (admin only)
router.get(
  "/",
  authenticateToken,
  isAdmin,
  async (req: AuthRequest<{}, {}, {}, TransactionsQuery>, res) => {
    try {
      const { type, user_id } = req.query;

      let query = `
      SELECT 
        transactions.*,
        users.email as user_email,
        users.first_name || ' ' || users.last_name as user_name
      FROM transactions
      JOIN users ON transactions.user_id = users.id
      WHERE 1=1
    `;

      const params = [];
      let paramCount = 1;

      if (type) {
        query += ` AND transactions.type = $${paramCount}`;
        params.push(type);
        paramCount++;
      }

      if (user_id) {
        query += ` AND transactions.user_id = $${paramCount}`;
        params.push(user_id);
        paramCount++;
      }

      query += ` ORDER BY transactions.created_at DESC`;

      const result = await pool.query<Transaction>(query, params);

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get all transactions error:", err);
      return res.status(500).json({ error: "Failed to retrieve transactions" });
    }
  },
);

export default router;
