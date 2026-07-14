import express, { Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateModifierBody,
  ItemModifier,
  UpdateModifierBody,
} from "@/types";

const router = express.Router();

// ========================================
// GET all modifiers
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<ItemModifier[]>>) => {
    try {
      const modifiers = await prisma.modifiers.findMany({
        orderBy: { name: "asc" },
      });

      // Перетворюємо Decimal у number для фронтенда
      const data: ItemModifier[] = modifiers.map((m) => ({
        ...m,
        default_price: Number(m.default_price),
      }));

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      console.error("Get modifiers error:", err);
      return res.status(500).json({ error: "Failed to retrieve modifiers" });
    }
  },
);

// ========================================
// CREATE modifier
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateModifierBody & { category_id: number }>,
    res: Response<APIResponse<ItemModifier>>,
  ) => {
    try {
      const { name, description, default_price, category_id, display_order } =
        req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const modifier = await prisma.modifiers.create({
        data: {
          name,
          description,
          default_price: default_price || 0,
          category_id,
          display_order: display_order ?? 0,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Modifier created successfully",
        data: { ...modifier, default_price: Number(modifier.default_price) },
      });
    } catch (err) {
      console.error("Create modifier error:", err);
      return res.status(500).json({ error: "Failed to create modifier" });
    }
  },
);

// ========================================
// UPDATE modifier
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateModifierBody>,
    res: Response<APIResponse<ItemModifier>>,
  ) => {
    try {
      const { id } = req.params;
      const { name, description, default_price, category_id, display_order } =
        req.body;

      const updated = await prisma.modifiers.update({
        where: { id: parseInt(id) },
        data: {
          name: name || undefined,
          description: description !== undefined ? description : undefined,
          default_price:
            default_price !== undefined ? default_price : undefined,
          category_id: category_id || undefined,
          display_order:
            display_order !== undefined ? display_order : undefined,
          updated_at: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Modifier updated successfully",
        data: { ...updated, default_price: Number(updated.default_price) },
      });
    } catch (err) {
      console.error("Update modifier error:", err);
      return res
        .status(404)
        .json({ error: "Modifier not found or update failed" });
    }
  },
);

// ========================================
// DELETE modifier
// ========================================
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<{ id: number; name: string }>>,
  ) => {
    try {
      const { id } = req.params;

      const deleted = await prisma.modifiers.delete({
        where: { id: parseInt(id) },
      });

      return res.json({
        success: true,
        data: { id: deleted.id, name: deleted.name },
        message: "Modifier deleted successfully",
      });
    } catch (err) {
      console.error("Delete modifier error:", err);
      return res.status(500).json({ error: "Failed to delete modifier" });
    }
  },
);

export default router;
