import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import { AuthRequest, CreateVariationBody, UpdateVariationBody } from "@/types";

const router = Router();

// ========================================
// GET all variations (with category name)
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response) => {
    try {
      const variations = await prisma.variations.findMany({
        include: {
          variation_categories: {
            select: { name: true, display_order: true },
          },
        },
        orderBy: [
          { variation_categories: { display_order: "asc" } },
          { name: "asc" },
        ],
      });

      // Мапимо результат, щоб додати category_name як плоске поле (для сумісності)
      const data = variations.map((v) => ({
        ...v,
        default_price: v.default_price ? Number(v.default_price) : 0,
        category_name: v.variation_categories?.name || null,
      }));

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get variations error:", err);
      return res.status(500).json({ error: "Failed to retrieve variations" });
    }
  },
);

// ========================================
// CREATE variation
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{}, {}, CreateVariationBody>, res: Response) => {
    try {
      const { name, description, category_id, default_price, display_order } =
        req.body;

      if (!name) return res.status(400).json({ error: "Name is required" });

      const variation = await prisma.variations.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          category_id: category_id ? Number(category_id) : null,
          default_price: default_price ? Number(default_price) : 0,
          display_order: display_order ?? 0,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Variation created successfully",
        data: { ...variation, default_price: Number(variation.default_price) },
      });
    } catch (err) {
      console.error("Create variation error:", err);
      return res.status(500).json({ error: "Failed to create variation" });
    }
  },
);

// ========================================
// UPDATE variation
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateVariationBody>,
    res: Response,
  ) => {
    try {
      const { id } = req.params;
      const { name, description, category_id, default_price, display_order } =
        req.body;

      const updated = await prisma.variations.update({
        where: { id: parseInt(id) },
        data: {
          name: name?.trim(),
          description:
            description !== undefined ? description?.trim() || null : undefined,
          category_id:
            category_id !== undefined ? Number(category_id) : undefined,
          default_price:
            default_price !== undefined ? Number(default_price) : undefined,
          display_order:
            display_order !== undefined ? display_order : undefined,
          updated_at: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Variation updated successfully",
        data: { ...updated, default_price: Number(updated.default_price) },
      });
    } catch (err) {
      console.error("Update variation error:", err);
      return res.status(404).json({ error: "Variation not found" });
    }
  },
);

// ========================================
// DELETE variation
// ========================================
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const deleted = await prisma.variations.delete({
        where: { id: parseInt(req.params.id) },
      });

      return res.json({
        success: true,
        message: "Variation deleted successfully",
        data: { ...deleted, default_price: Number(deleted.default_price) },
      });
    } catch (err) {
      console.error("Delete variation error:", err);
      return res.status(404).json({ error: "Variation not found" });
    }
  },
);

export default router;
