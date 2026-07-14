import express, { Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdmin } from "../middleware/auth";
import { isValidRole } from "../utils/validation";
import {
  AuthRequest,
  ErrorResponse,
  PaginatedSuccessResponse,
  SafeUser,
  SuccessResponse,
} from "@/types";

const router = express.Router();

// ========================================
// GET all users (admin only) - Filtered & Paginated
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdmin,
  async (
    req: AuthRequest<
      {},
      {},
      {},
      {
        page?: string;
        limit?: string;
        search?: string;
        role?: "customer" | "staff" | "admin";
      }
    >,
    res: Response<PaginatedSuccessResponse<SafeUser[]> | ErrorResponse>,
  ) => {
    try {
      const page = parseInt(req.query.page || "1");
      const limit = parseInt(req.query.limit || "10");
      const search = req.query.search || "";
      const role = req.query.role || undefined;

      const skip = (page - 1) * limit;

      const where: any = {
        AND: [
          role ? { role } : {},
          search
            ? {
                OR: [
                  { first_name: { contains: search, mode: "insensitive" } },
                  { last_name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      };

      const [users, totalCount] = await Promise.all([
        prisma.users.findMany({
          where,
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            created_at: true,
            balance: true,
          },
          orderBy: { created_at: "desc" },
          take: limit,
          skip: skip,
        }),
        prisma.users.count({ where }),
      ]);

      return res.json({
        success: true,
        data: users.map((u) => ({
          ...u,
          balance: Number(u.balance),
        })) as unknown as SafeUser[],
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      console.error("Filtered users error:", err);
      return res.status(500).json({ error: "Failed to retrieve users" });
    }
  },
);

// ========================================
// GET single user (admin only)
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdmin,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<SuccessResponse<SafeUser> | ErrorResponse>,
  ) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: parseInt(req.params.id) },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
          balance: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        data: { ...user, balance: Number(user.balance) } as unknown as SafeUser,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve user" });
    }
  },
);

// ========================================
// UPDATE user role (admin only)
// ========================================
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
        return res.status(400).json({ error: "Invalid role" });
      }

      const updatedUser = await prisma.users.update({
        where: { id: parseInt(id) },
        data: { role },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
        },
      });

      return res.json({
        success: true,
        message: "User role updated successfully",
        data: updatedUser as SafeUser,
      });
    } catch (err) {
      return res.status(404).json({ error: "User not found or update failed" });
    }
  },
);

// ========================================
// DELETE user (admin only)
// ========================================
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
      const targetId = parseInt(req.params.id);

      if (targetId === req.user?.userId) {
        return res
          .status(400)
          .json({ error: "You cannot delete your own account" });
      }

      const deleted = await prisma.users.delete({
        where: { id: targetId },
        select: { id: true, email: true },
      });

      return res.json({
        success: true,
        message: "User deleted successfully",
        data: deleted,
      });
    } catch (err) {
      return res.status(404).json({ error: "User not found" });
    }
  },
);

export default router;
