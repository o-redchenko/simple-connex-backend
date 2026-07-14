import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  ModifierCategoryWithModifiers,
  APIResponse,
} from "../types";

const router = Router();

// ========================================
// GET all modifier categories WITH modifiers
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    _req: AuthRequest,
    res: Response<APIResponse<ModifierCategoryWithModifiers[]>>,
  ) => {
    try {
      const categories = await prisma.modifier_categories.findMany({
        include: {
          modifiers: {
            orderBy: { display_order: "asc" },
          },
        },
        orderBy: { display_order: "asc" },
      });

      // Мапимо Decimal у number для цін модифікаторів
      const data = categories.map((cat) => ({
        ...cat,
        modifiers: cat.modifiers.map((m) => ({
          ...m,
          default_price: Number(m.default_price),
        })),
      }));

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get modifier categories error:", err);
      return res
        .status(500)
        .json({ error: "Failed to retrieve modifier categories" });
    }
  },
);

// ========================================
// GET single modifier category
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<ModifierCategoryWithModifiers>>,
  ) => {
    try {
      const id = parseInt(req.params.id);
      const category = await prisma.modifier_categories.findUnique({
        where: { id },
        include: {
          modifiers: { orderBy: { display_order: "asc" } },
        },
      });

      if (!category)
        return res.status(404).json({ error: "Modifier category not found" });

      const data = {
        ...category,
        modifiers: category.modifiers.map((m) => ({
          ...m,
          default_price: Number(m.default_price),
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Failed to retrieve modifier category" });
    }
  },
);

// ========================================
// CREATE modifier category
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<
      {},
      {},
      { name: string; description?: string; display_order?: number }
    >,
    res: Response<APIResponse<ModifierCategoryWithModifiers>>,
  ) => {
    try {
      const { name, description, display_order } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Визначаємо наступний display_order, якщо не передано
      let order = display_order;
      if (order === undefined) {
        const lastCategory = await prisma.modifier_categories.findFirst({
          orderBy: { display_order: "desc" },
          select: { display_order: true },
        });
        order = (lastCategory?.display_order ?? -1) + 1;
      }

      const newCategory = await prisma.modifier_categories.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          display_order: order,
        },
        include: { modifiers: true },
      });

      return res
        .status(201)
        .json({ success: true, data: { ...newCategory, modifiers: [] } });
    } catch (err) {
      console.error("Create error:", err);
      return res
        .status(500)
        .json({ error: "Failed to create modifier category" });
    }
  },
);

// ========================================
// UPDATE modifier category
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<
      { id: string },
      {},
      { name?: string; description?: string; display_order?: number }
    >,
    res: Response<APIResponse<ModifierCategoryWithModifiers>>,
  ) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, display_order } = req.body;

      const updated = await prisma.modifier_categories.update({
        where: { id },
        data: {
          name: name?.trim(),
          description:
            description !== undefined ? description?.trim() : undefined,
          display_order,
          updated_at: new Date(),
        },
        include: {
          modifiers: { orderBy: { display_order: "asc" } },
        },
      });

      const data = {
        ...updated,
        modifiers: updated.modifiers.map((m) => ({
          ...m,
          default_price: Number(m.default_price),
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      return res
        .status(404)
        .json({ error: "Modifier category not found or update failed" });
    }
  },
);

// ========================================
// DELETE modifier category
// ========================================
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Перевірка на наявність модифікаторів через Prisma
      const count = await prisma.modifiers.count({
        where: { category_id: id },
      });

      if (count > 0) {
        return res.status(400).json({
          error: `Cannot delete modifier category. It has ${count} modifier(s).`,
        });
      }

      await prisma.modifier_categories.delete({ where: { id } });

      return res.json({
        success: true,
        data: { message: "Modifier category deleted successfully" },
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Failed to delete modifier category" });
    }
  },
);

export default router;
