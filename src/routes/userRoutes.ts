import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdmin } from "../middleware/auth";
import { isValidRole } from "../utils/validation";
import { AuthRequest, ErrorResponse, SafeUser, SuccessResponse } from "@/types";

const router = express.Router();

// Get all users (admin only)
router.get(
  "/",
  authenticateToken,
  isAdmin,
  async (
    _req: AuthRequest,
    res: Response<SuccessResponse<SafeUser[]> | ErrorResponse>,
  ) => {
    try {
      const result = await pool.query<SafeUser>(
        "SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC",
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get users error:", err);
      return res.status(500).json({ error: "Failed to retrieve users" });
    }
  },
);

// Get single user (admin only)
router.get(
  "/:id",
  authenticateToken,
  isAdmin,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<SuccessResponse<SafeUser> | ErrorResponse>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Get user error:", err);
      return res.status(500).json({ error: "Failed to retrieve user" });
    }
  },
);

// Update user role (admin only)
router.put(
  "/:id/role",
  authenticateToken,
  isAdmin,
  async (
    req: AuthRequest<
      { id: string },
      {},
      { role: "customer" | "staff" | "admin" }
    >,
    res: Response<SuccessResponse<SafeUser> | ErrorResponse>,
  ) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !isValidRole(role)) {
        return res
          .status(400)
          .json({ error: "Invalid role. Must be: customer, staff, or admin" });
      }

      const result = await pool.query(
        "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, first_name, last_name, role",
        [role, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        message: "User role updated successfully",
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Update role error:", err);
      return res.status(500).json({ error: "Failed to update user role" });
    }
  },
);

// Delete user (admin only)
router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<
      SuccessResponse<{ id: number; email: string }> | ErrorResponse
    >,
  ) => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (parseInt(id) === req.user?.userId) {
        return res
          .status(400)
          .json({ error: "You cannot delete your own account" });
      }

      const result = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING id, email",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        message: "User deleted successfully",
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Delete user error:", err);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  },
);

export default router;
