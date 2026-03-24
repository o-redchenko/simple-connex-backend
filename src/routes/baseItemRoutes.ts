import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  BaseItem,
  BaseItemWithCategories,
  APIResponse,
  UpdateBaseItemBody,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

const router = Router();

// ========================================
// GET all base items
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    _req: AuthRequest,
    res: Response<APIResponse<BaseItemWithCategories[]>>,
  ) => {
    try {
      const result = await pool.query(
        `SELECT 
          bi.*,
          COALESCE(
            json_agg(DISTINCT bivc.variation_category_id) FILTER (WHERE bivc.variation_category_id IS NOT NULL),
            '[]'
          ) as variation_categories,
          COALESCE(
            json_agg(DISTINCT bimc.modifier_category_id) FILTER (WHERE bimc.modifier_category_id IS NOT NULL),
            '[]'
          ) as modifier_categories
         FROM base_items bi
         LEFT JOIN base_item_variation_categories bivc ON bi.id = bivc.base_item_id
         LEFT JOIN base_item_modifier_categories bimc ON bi.id = bimc.base_item_id
         GROUP BY bi.id
         ORDER BY bi.name`,
      );

      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get base items error:", err);
      return res.status(500).json({ error: "Failed to retrieve base items" });
    }
  },
);

// ========================================
// GET single base item
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<BaseItemWithCategories>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          bi.*,
          COALESCE(
            json_agg(DISTINCT bivc.variation_category_id) FILTER (WHERE bivc.variation_category_id IS NOT NULL),
            '[]'
          ) as variation_categories,
          COALESCE(
            json_agg(DISTINCT bimc.modifier_category_id) FILTER (WHERE bimc.modifier_category_id IS NOT NULL),
            '[]'
          ) as modifier_categories
         FROM base_items bi
         LEFT JOIN base_item_variation_categories bivc ON bi.id = bivc.base_item_id
         LEFT JOIN base_item_modifier_categories bimc ON bi.id = bimc.base_item_id
         WHERE bi.id = $1
         GROUP BY bi.id`,
        [id],
      );

      const baseItem = getRowOrNotFound(
        result.rows,
        res,
        "Base item not found",
      );
      if (!baseItem) {
        throw new Error("Base item not found");
      }

      return res.json({ success: true, data: baseItem });
    } catch (err) {
      console.error("Get base item error:", err);
      return res.status(500).json({ error: "Failed to retrieve base item" });
    }
  },
);

// ========================================
// CREATE base item
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<
      {},
      {},
      {
        name: string;
        description?: string;
        base_price: number;
        base_image_url?: string;
        variation_category_ids?: number[];
        modifier_category_ids?: number[];
      }
    >,
    res: Response<APIResponse<BaseItem>>,
  ) => {
    const client = await pool.connect();

    try {
      const {
        name,
        description,
        base_price,
        base_image_url,
        variation_category_ids,
        modifier_category_ids,
      } = req.body;

      if (!name || base_price === undefined) {
        return res
          .status(400)
          .json({ error: "Name and base_price are required" });
      }

      await client.query("BEGIN");

      // Create base item
      const result = await client.query<BaseItem>(
        `INSERT INTO base_items (name, description, base_price, base_image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, base_price, base_image_url || null],
      );

      const baseItem = result.rows[0];

      if (!baseItem) {
        throw new Error("Failed to create base item");
      }

      // Add variation categories
      if (variation_category_ids && variation_category_ids.length > 0) {
        for (const catId of variation_category_ids) {
          await client.query(
            `INSERT INTO base_item_variation_categories (base_item_id, variation_category_id)
             VALUES ($1, $2)`,
            [baseItem.id, catId],
          );
        }
      }

      // Add modifier categories
      if (modifier_category_ids && modifier_category_ids.length > 0) {
        for (const catId of modifier_category_ids) {
          await client.query(
            `INSERT INTO base_item_modifier_categories (base_item_id, modifier_category_id)
             VALUES ($1, $2)`,
            [baseItem.id, catId],
          );
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({ success: true, data: baseItem });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create base item error:", err);
      return res.status(500).json({ error: "Failed to create base item" });
    } finally {
      client.release();
    }
  },
);

// ========================================
// UPDATE base item
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<
      { id: string },
      {},
      UpdateBaseItemBody
      
    >,
    res: Response<APIResponse<BaseItemWithCategories>>,
  ) => {
    const client = await pool.connect();
    const { id } = req.params;
    const {
      name,
      description,
      base_price,
      base_image_url,
      variation_category_ids,
      modifier_category_ids,
    } = req.body;

    try {
      await client.query("BEGIN");

      // 1. Build Dynamic Update for base_items table
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (base_price !== undefined) {
        updates.push(`base_price = $${paramCount++}`);
        values.push(base_price);
      }
      if (base_image_url !== undefined) {
        updates.push(`base_image_url = $${paramCount++}`);
        values.push(base_image_url);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        const updateQuery = `
          UPDATE base_items 
          SET ${updates.join(", ")} 
          WHERE id = $${paramCount} 
          RETURNING *`;
        values.push(id);
        await client.query(updateQuery, values);
      }

      // 2. Update Variation Categories (Sync pattern)
      if (variation_category_ids !== undefined) {
        await client.query(
          "DELETE FROM base_item_variation_categories WHERE base_item_id = $1",
          [id],
        );
        if (variation_category_ids.length > 0) {
          await client.query(
            `INSERT INTO base_item_variation_categories (base_item_id, variation_category_id)
             SELECT $1, unnest($2::int[])`,
            [id, variation_category_ids],
          );
        }
      }

      // 3. Update Modifier Categories (Sync pattern)
      if (modifier_category_ids !== undefined) {
        await client.query(
          "DELETE FROM base_item_modifier_categories WHERE base_item_id = $1",
          [id],
        );
        if (modifier_category_ids.length > 0) {
          await client.query(
            `INSERT INTO base_item_modifier_categories (base_item_id, modifier_category_id)
             SELECT $1, unnest($2::int[])`,
            [id, modifier_category_ids],
          );
        }
      }

      await client.query("COMMIT");

      // 4. Return full updated object (re-using your GET logic for consistency)
      const finalResult = await client.query(
        `SELECT 
          bi.*,
          COALESCE(json_agg(DISTINCT bivc.variation_category_id) FILTER (WHERE bivc.variation_category_id IS NOT NULL), '[]') as variation_categories,
          COALESCE(json_agg(DISTINCT bimc.modifier_category_id) FILTER (WHERE bimc.modifier_category_id IS NOT NULL), '[]') as modifier_categories
         FROM base_items bi
         LEFT JOIN base_item_variation_categories bivc ON bi.id = bivc.base_item_id
         LEFT JOIN base_item_modifier_categories bimc ON bi.id = bimc.base_item_id
         WHERE bi.id = $1
         GROUP BY bi.id`,
        [id],
      );

      return res.json({ success: true, data: finalResult.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update error:", err);
      return res
        .status(500)
        .json({ error: "Failed to update base item fully" });
    } finally {
      client.release();
    }
  },
);

// ========================================
// DELETE base item
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

      // Check if base item is used in any menu items
      const usageCheck = await pool.query(
        "SELECT COUNT(*) as count FROM menu_items WHERE base_item_id = $1",
        [id],
      );

      const usageCount = parseInt(usageCheck.rows[0].count);

      if (usageCount > 0) {
        return res.status(400).json({
          error: `Cannot delete base item. It is used in ${usageCount} menu item(s).`,
        });
      }

      const result = await pool.query(
        "DELETE FROM base_items WHERE id = $1 RETURNING id",
        [id],
      );

      const deletedBaseItem = getRowOrNotFound(
        result.rows,
        res,
        "Base item not found",
      );
      if (!deletedBaseItem) {
        throw new Error("Base item not found");
      }

      return res.json({
        success: true,
        data: { message: "Base item deleted successfully" },
      });
    } catch (err) {
      console.error("Delete base item error:", err);
      return res.status(500).json({ error: "Failed to delete base item" });
    }
  },
);

export default router;
