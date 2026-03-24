import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateCategoryBody,
  MenuCategory,
  UpdateCategoryBody,
  MenuCategoryWithItems,
} from "@/types";
import { getRowOrNotFound } from "@/utils/response";

const router = express.Router();

// Get all categories for a menu
router.get(
  "/menu/:menuId",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ menuId: string }>,
    res: Response<APIResponse<MenuCategoryWithItems[]>>,
  ) => {
    try {
      const { menuId } = req.params;

      const result = await pool.query<MenuCategoryWithItems>(
        `SELECT 
        menu_categories.*,
        COUNT(menu_items.id) as item_count
       FROM menu_categories
       LEFT JOIN menu_items ON menu_categories.id = menu_items.menu_category_id
       WHERE menu_categories.menu_id = $1
       GROUP BY menu_categories.id
       ORDER BY menu_categories.display_order`,
        [menuId],
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get categories error:", err);
      return res.status(500).json({ error: "Failed to retrieve categories" });
    }
  },
);

// ========================================
// GET single category by ID
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query<MenuCategory>(
        "SELECT * FROM menu_categories WHERE id = $1",
        [id],
      );

      const category = getRowOrNotFound(result.rows, res, "Category not found");
      if (!category) throw new Error("Category not found");

      return res.json({ success: true, data: category });
    } catch (err) {
      console.error("Get category error:", err);
      return res.status(500).json({ error: "Failed to retrieve category" });
    }
  },
);

// ========================================
// CREATE category
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateCategoryBody>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    try {
      const { menu_id, name, description, image_url } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }

      if (!menu_id) {
        return res.status(400).json({ error: "Menu ID is required" });
      }

      // Get max display_order
      const maxOrderResult = await pool.query(
        `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
         FROM menu_categories 
         WHERE menu_id = $1`,
        [menu_id],
      );
      const displayOrder = maxOrderResult.rows[0].next_order;

      const result = await pool.query<MenuCategory>(
        `INSERT INTO menu_categories (menu_id, name, description, image_url, display_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          menu_id,
          name.trim(),
          description?.trim() || null,
          image_url || null,
          displayOrder,
        ],
      );

      const category = getRowOrNotFound(
        result.rows,
        res,
        "Failed to create category",
      );
      if (!category) {
        throw new Error("Failed to create category");
      }

      return res.status(201).json({ success: true, data: category });
    } catch (err) {
      console.error("Create category error:", err);
      return res.status(500).json({ error: "Failed to create category" });
    }
  },
);

// ========================================
// UPDATE category (name, description, image)
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateCategoryBody>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { name, description, image_url, items } = req.body;

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
      if (image_url !== undefined) {
        updates.push(`image_url = $${paramCount++}`);
        values.push(image_url || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await pool.query<MenuCategory>(
        `UPDATE menu_categories SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
        values,
      );

      const updatedCategory = getRowOrNotFound(
        result.rows,
        res,
        "Category not found",
      );
      if (!updatedCategory) {
        await client.query("ROLLBACK");
        throw new Error("Category not found");
      }

      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(
            `UPDATE menu_items SET display_order = $1, updated_at = NOW() WHERE id = $2`,
            [item.display_order, item.id],
          );
        }
      }

      await client.query("COMMIT");

      const finalResult = await pool.query<MenuCategory>(
        `SELECT * FROM menu_categories WHERE id = $1`,
        [id],
      );

      const finalCategory = getRowOrNotFound(
        finalResult.rows,
        res,
        "Category not found",
      );
      if (!finalCategory) {
        throw new Error("Category not found");
      }

      return res.json({ success: true, data: updatedCategory });
    } catch (err) {
      console.error("Update category error:", err);
      return res.status(500).json({ error: "Failed to update category" });
    }
  },
);

// Delete category
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;

      await client.query("BEGIN");

      await client.query(
        `DELETE FROM menu_item_variations 
       WHERE menu_item_id IN (
         SELECT id FROM menu_items WHERE menu_category_id = $1
       )`,
        [id],
      );

      await client.query(
        `DELETE FROM menu_item_modifiers 
       WHERE menu_item_id IN (
         SELECT id FROM menu_items WHERE menu_category_id = $1
       )`,
        [id],
      );

      await client.query("DELETE FROM menu_items WHERE menu_category_id = $1", [
        id,
      ]);

      const result = await client.query(
        "DELETE FROM menu_categories WHERE id = $1 RETURNING *",
        [id],
      );

      await client.query("COMMIT");

      const category = getRowOrNotFound(result.rows, res, "Category not found");
      if (!category) return;

      return res.json({
        success: true,
        data: category,
        message: "Category deleted successfully",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Delete category error:", err);
      return res.status(500).json({ error: "Failed to delete category" });
    } finally {
      client.release();
    }
  },
);

export default router;
