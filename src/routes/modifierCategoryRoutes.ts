import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  ModifierCategoryWithModifiers,
  APIResponse,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

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
      const result = await pool.query(
        `SELECT 
          mc.id,
          mc.name,
          mc.description,
          mc.display_order,
          mc.created_at,
          mc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'category_id', m.category_id,
                'name', m.name,
                'default_price', m.default_price,
                'display_order', m.display_order,
                'created_at', m.created_at,
                'updated_at', m.updated_at
              ) ORDER BY m.display_order
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as modifiers
         FROM modifier_categories mc
         LEFT JOIN modifiers m ON mc.id = m.category_id
         GROUP BY mc.id
         ORDER BY mc.display_order`,
      );

      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get modifier categories error:", err);
      return res.status(500).json({
        error: "Failed to retrieve modifier categories",
      });
    }
  },
);

// ========================================
// GET single modifier category WITH modifiers
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
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          mc.id,
          mc.name,
          mc.description,
          mc.display_order,
          mc.created_at,
          mc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'category_id', m.category_id,
                'name', m.name,
                'default_price', m.default_price,
                'display_order', m.display_order,
                'created_at', m.created_at,
                'updated_at', m.updated_at
              ) ORDER BY m.display_order
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as modifiers
         FROM modifier_categories mc
         LEFT JOIN modifiers m ON mc.id = m.category_id
         WHERE mc.id = $1
         GROUP BY mc.id`,
        [id],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Modifier category not found",
      );
      if (!category) {
        throw new Error("Modifier category not found");
      }

      return res.json({ success: true, data: category });
    } catch (err) {
      console.error("Get modifier category error:", err);
      return res.status(500).json({
        error: "Failed to retrieve modifier category",
      });
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

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Get max display_order if not provided
      let order = display_order;
      if (order === undefined) {
        const maxOrderResult = await pool.query(
          `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order 
           FROM modifier_categories`,
        );
        order = maxOrderResult.rows[0].next_order;
      }

      const result = await pool.query(
        `INSERT INTO modifier_categories (name, description, display_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), description?.trim() || null, order],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Failed to create modifier category",
      );
      if (!category) {
        throw new Error("Failed to create modifier category");
      }

      // Return with empty modifiers array
      const categoryWithModifiers = {
        ...category,
        modifiers: [],
      };

      return res.status(201).json({
        success: true,
        data: categoryWithModifiers,
      });
    } catch (err) {
      console.error("Create modifier category error:", err);
      return res.status(500).json({
        error: "Failed to create modifier category",
      });
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
        `UPDATE modifier_categories SET ${updates.join(", ")} WHERE id = $${paramCount}`,
        values,
      );

      // Get updated category with modifiers
      const result = await client.query(
        `SELECT 
          mc.id,
          mc.name,
          mc.description,
          mc.display_order,
          mc.created_at,
          mc.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'category_id', m.category_id,
                'name', m.name,
                'default_price', m.default_price,
                'display_order', m.display_order,
                'created_at', m.created_at,
                'updated_at', m.updated_at
              ) ORDER BY m.display_order
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as modifiers
         FROM modifier_categories mc
         LEFT JOIN modifiers m ON mc.id = m.category_id
         WHERE mc.id = $1
         GROUP BY mc.id`,
        [id],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Modifier category not found",
      );
      if (!category) {
        await client.query("ROLLBACK");
        throw new Error("Modifier category not found");
      }

      await client.query("COMMIT");

      return res.json({ success: true, data: category });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update modifier category error:", err);
      return res.status(500).json({
        error: "Failed to update modifier category",
      });
    } finally {
      client.release();
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
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<{ message: string }>>,
  ) => {
    try {
      const { id } = req.params;

      // Check if category has modifiers
      const usageCheck = await pool.query(
        "SELECT COUNT(*) as count FROM modifiers WHERE category_id = $1",
        [id],
      );

      const usageCount = parseInt(usageCheck.rows[0].count);

      if (usageCount > 0) {
        return res.status(400).json({
          error: `Cannot delete modifier category. It has ${usageCount} modifier(s).`,
        });
      }

      const result = await pool.query(
        "DELETE FROM modifier_categories WHERE id = $1 RETURNING id",
        [id],
      );

      const deletedCategory = getRowOrNotFound(
        result.rows,
        res,
        "Modifier category not found",
      );
      if (!deletedCategory) {
        throw new Error("Modifier category not found");
      }

      return res.json({
        success: true,
        data: { message: "Modifier category deleted successfully" },
      });
    } catch (err) {
      console.error("Delete modifier category error:", err);
      return res.status(500).json({
        error: "Failed to delete modifier category",
      });
    }
  },
);

export default router;
