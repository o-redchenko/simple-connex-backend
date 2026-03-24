import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  VariationCategoryWithVariations,
  APIResponse,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

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
      const result = await pool.query(
        `SELECT 
          vc.id,
          vc.name,
          vc.description,
          vc.display_order,
          vc.created_at,
          vc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', v.id,
                'category_id', v.category_id,
                'name', v.name,
                'default_price', v.default_price,
                'display_order', v.display_order,
                'created_at', v.created_at,
                'updated_at', v.updated_at
              ) ORDER BY v.display_order
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'
          ) as variations
         FROM variation_categories vc
         LEFT JOIN variations v ON vc.id = v.category_id
         GROUP BY vc.id
         ORDER BY vc.display_order`,
      );

      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get variation categories error:", err);
      return res.status(500).json({
        error: "Failed to retrieve variation categories",
      });
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
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<VariationCategoryWithVariations>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          vc.id,
          vc.name,
          vc.description,
          vc.display_order,
          vc.created_at,
          vc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', v.id,
                'category_id', v.category_id,
                'name', v.name,
                'default_price', v.default_price,
                'display_order', v.display_order,
                'created_at', v.created_at,
                'updated_at', v.updated_at
              ) ORDER BY v.display_order
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'
          ) as variations
         FROM variation_categories vc
         LEFT JOIN variations v ON vc.id = v.category_id
         WHERE vc.id = $1
         GROUP BY vc.id`,
        [id],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Variation category not found",
      );
      if (!category) {
        throw new Error("Variation category not found");
      }

      return res.json({ success: true, data: category });
    } catch (err) {
      console.error("Get variation category error:", err);
      return res.status(500).json({
        error: "Failed to retrieve variation category",
      });
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
    res: Response<APIResponse<VariationCategoryWithVariations>>,
  ) => {
    try {
      const { name, description, display_order } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Get max display_order if not provided
      let order = display_order;
      if (order === undefined) {
        const maxOrderResult = await pool.query(
          `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order 
           FROM variation_categories`,
        );
        order = maxOrderResult.rows[0].next_order;
      }

      const result = await pool.query(
        `INSERT INTO variation_categories (name, description, display_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), description?.trim() || null, order],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Failed to create variation category",
      );
      if (!category) {
        throw new Error("Failed to create variation category");
      }

      // Return with empty variations array
      const categoryWithVariations = {
        ...category,
        variations: [],
      };

      return res.status(201).json({
        success: true,
        data: categoryWithVariations,
      });
    } catch (err) {
      console.error("Create variation category error:", err);
      return res.status(500).json({
        error: "Failed to create variation category",
      });
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
    res: Response<APIResponse<VariationCategoryWithVariations>>,
  ) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { name, description, display_order } = req.body;

      await client.query("BEGIN");

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description?.trim() || null);
      }
      if (display_order !== undefined) {
        updates.push(`display_order = $${paramCount++}`);
        values.push(display_order);
      }

      if (updates.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      await client.query(
        `UPDATE variation_categories SET ${updates.join(", ")} WHERE id = $${paramCount}`,
        values,
      );

      // Get updated category with variations
      const result = await client.query(
        `SELECT 
          vc.id,
          vc.name,
          vc.description,
          vc.display_order,
          vc.created_at,
          vc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', v.id,
                'category_id', v.category_id,
                'name', v.name,
                'default_price', v.default_price,
                'display_order', v.display_order,
                'created_at', v.created_at,
                'updated_at', v.updated_at
              ) ORDER BY v.display_order
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'
          ) as variations
         FROM variation_categories vc
         LEFT JOIN variations v ON vc.id = v.category_id
         WHERE vc.id = $1
         GROUP BY vc.id`,
        [id],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Variation category not found",
      );
      if (!category) {
        await client.query("ROLLBACK");
        throw new Error("Variation category not found");
      }

      await client.query("COMMIT");

      return res.json({ success: true, data: category });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update variation category error:", err);
      return res.status(500).json({
        error: "Failed to update variation category",
      });
    } finally {
      client.release();
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
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<{ message: string }>>,
  ) => {
    try {
      const { id } = req.params;

      // Check if category has variations
      const usageCheck = await pool.query(
        "SELECT COUNT(*) as count FROM variations WHERE category_id = $1",
        [id],
      );

      const usageCount = parseInt(usageCheck.rows[0].count);

      if (usageCount > 0) {
        return res.status(400).json({
          error: `Cannot delete variation category. It has ${usageCount} variation(s).`,
        });
      }

      const result = await pool.query(
        "DELETE FROM variation_categories WHERE id = $1 RETURNING id",
        [id],
      );

      const deletedCategory = getRowOrNotFound(
        result.rows,
        res,
        "Variation category not found",
      );
      if (!deletedCategory) {
        throw new Error("Variation category not found");
      }

      return res.json({
        success: true,
        data: { message: "Variation category deleted successfully" },
      });
    } catch (err) {
      console.error("Delete variation category error:", err);
      return res.status(500).json({
        error: "Failed to delete variation category",
      });
    }
  },
);

export default router;
