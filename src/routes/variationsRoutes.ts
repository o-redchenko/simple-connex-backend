import express, { Response } from "express";
const router = express.Router();
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateVariationBody,
  DeleteVariationRes,
  UpdateVariationBody,
  ItemVariation,
  VariationWithCategory,
  Variation,
} from "@/types";
import { getRowOrFailed, getRowOrNotFound } from "@/utils/response";

// ===== VARIATIONS =====

// Get all variations
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    _req: AuthRequest,
    res: Response<APIResponse<VariationWithCategory[]>>,
  ) => {
    try {
      const result = await pool.query<VariationWithCategory>(
        `SELECT 
        variations.*,
        variation_categories.name as category_name
       FROM variations
       LEFT JOIN variation_categories ON variations.category_id = variation_categories.id
       ORDER BY variation_categories.display_order, variations.name`,
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get variations error:", err);
      return res.status(500).json({ error: "Failed to retrieve variations" });
    }
  },
);

// Create variation
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateVariationBody>,
    res: Response<APIResponse<ItemVariation>>,
  ) => {
    try {
      const { name, description, category_id } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await pool.query<ItemVariation>(
        "INSERT INTO variations (name, description, category_id) VALUES ($1, $2, $3) RETURNING *",
        [name, description, category_id ?? null],
      );

      const variation = getRowOrFailed(
        result.rows,
        res,
        "Failed to create variation",
      );
      if (!variation) return;

      return res.status(201).json({
        success: true,
        message: "Variation created successfully",
        data: variation,
      });
    } catch (err) {
      console.error("Create variation error:", err);
      return res.status(500).json({ error: "Failed to create variation" });
    }
  },
);

// Update variation
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }, {}, UpdateVariationBody>, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const result = await pool.query<ItemVariation>(
        `UPDATE variations 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description)
       WHERE id = $3 
       RETURNING *`,
        [name, description, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Variation not found" });
      }

      return res.json({
        success: true,
        message: "Variation updated successfully",
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Update variation error:", err);
      return res.status(500).json({ error: "Failed to update variation" });
    }
  },
);

// Delete variation
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<DeleteVariationRes>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query<Variation>(
        "DELETE FROM variations WHERE id = $1 RETURNING *",
        [id],
      );

      const deletedVariation = getRowOrNotFound(
        result.rows,
        res,
        "Variation not found",
      );

      if (!deletedVariation) {
        return;
      }

      return res.json({
        success: true,
        data: deletedVariation,
        message: "Variation deleted successfully",
      });
    } catch (err) {
      console.error("Delete variation error:", err);
      return res.status(500).json({ error: "Failed to delete variation" });
    }
  },
);

export default router;
