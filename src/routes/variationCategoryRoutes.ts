import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  VariationCategoryWithVariations,
  APIResponse,
} from "../types";

const router = Router();

// ========================================
// GET all variation categories WITH variations
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    _req: AuthRequest,
    res: Response<APIResponse<VariationCategoryWithVariations[]>>,
  ) => {
    try {
      const categories = await prisma.variation_categories.findMany({
        include: {
          variations: {
            orderBy: { display_order: "asc" },
          },
        },
        orderBy: { display_order: "asc" },
      });

      // Перетворюємо Decimal в Number для фронтенду
      const data = categories.map((cat) => ({
        ...cat,
        variations: cat.variations.map((v) => ({
          ...v,
          default_price: Number(v.default_price),
        })),
      })) as unknown as VariationCategoryWithVariations[];

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get variation categories error:", err);
      return res.status(500).json({ error: "Failed to retrieve categories" });
    }
  },
);

// ========================================
// GET single variation category WITH variations
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const category = await prisma.variation_categories.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          variations: {
            orderBy: { display_order: "asc" },
          },
        },
      });

      if (!category)
        return res.status(404).json({ error: "Category not found" });

      const data = {
        ...category,
        variations: category.variations.map((v) => ({
          ...v,
          default_price: Number(v.default_price),
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve category" });
    }
  },
);

// ========================================
// CREATE variation category
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
    res: Response,
  ) => {
    try {
      const { name, description, display_order } = req.body;
      if (!name?.trim())
        return res.status(400).json({ error: "Name is required" });

      // Розрахунок наступного display_order, якщо не надано
      let order = display_order;
      if (order === undefined) {
        const lastCat = await prisma.variation_categories.findFirst({
          orderBy: { display_order: "desc" },
          select: { display_order: true },
        });
        order = (lastCat?.display_order ?? -1) + 1;
      }

      const newCategory = await prisma.variation_categories.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          display_order: order,
        },
        include: { variations: true },
      });

      return res
        .status(201)
        .json({ success: true, data: { ...newCategory, variations: [] } });
    } catch (err) {
      return res.status(500).json({ error: "Failed to create category" });
    }
  },
);

// ========================================
// UPDATE variation category
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
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      const { name, description, display_order } = req.body;

      const updated = await prisma.variation_categories.update({
        where: { id: parseInt(id) },
        data: {
          name: name?.trim(),
          description:
            description !== undefined ? description?.trim() || null : undefined,
          display_order,
          updated_at: new Date(),
        },
        include: {
          variations: { orderBy: { display_order: "asc" } },
        },
      });

      const data = {
        ...updated,
        variations: updated.variations.map((v) => ({
          ...v,
          default_price: Number(v.default_price),
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      return res
        .status(404)
        .json({ error: "Category not found or update failed" });
    }
  },
);

// ========================================
// DELETE variation category
// ========================================
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Перевірка на наявність варіацій (Prisma не видалить автоматично, якщо є зв'язки без CASCADE)
      const variationsCount = await prisma.variations.count({
        where: { category_id: id },
      });

      if (variationsCount > 0) {
        return res.status(400).json({
          error: `Cannot delete category. It has ${variationsCount} variations.`,
        });
      }

      await prisma.variation_categories.delete({ where: { id } });

      return res.json({
        success: true,
        data: { message: "Category deleted successfully" },
      });
    } catch (err) {
      return res.status(404).json({ error: "Category not found" });
    }
  },
);

export default router;
