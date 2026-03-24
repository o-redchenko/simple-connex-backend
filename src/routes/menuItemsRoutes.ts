import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  MenuItem,
  MenuItemWithDetails,
  ReorderItemsBody,
  ErrorResponse,
  APIResponse,
  AvailableOptionsForMenuItem,
  CreateMenuItemBody,
  UpdateMenuItemBody,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

const router = Router();

// ========================================
// GET items for a category
// ========================================
router.get(
  "/category/:categoryId",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ categoryId: string }>,
    res: Response<APIResponse<MenuItemWithDetails[]>>,
  ) => {
    try {
      const { categoryId } = req.params;

      const result = await pool.query<MenuItemWithDetails>(
        `SELECT 
        menu_items.*,
        base_items.name as base_item_name,
        base_items.description as base_description,
        base_items.base_price as base_price,
        base_items.base_image_url as base_image_url,
        COALESCE(menu_items.custom_name, base_items.name) as display_name,
        COALESCE(menu_items.custom_description, base_items.description) as display_description,
        COALESCE(menu_items.custom_price, base_items.base_price) as display_price,
        COALESCE(menu_items.custom_image_url, base_items.base_image_url) as display_image_url
       FROM menu_items
       JOIN base_items ON menu_items.base_item_id = base_items.id
       WHERE menu_items.menu_category_id = $1
       ORDER BY menu_items.display_order`,
        [categoryId],
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get menu items error:", err);
      res.status(500).json({ error: "Failed to retrieve menu items" });
    }
  },
);

// ========================================
// GET single item with variations and modifiers
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<MenuItemWithDetails>>,
  ) => {
    try {
      const { id } = req.params;

      // Get item details
      const itemResult = await pool.query<MenuItemWithDetails>(
        `SELECT 
        menu_items.*,
        base_items.name as base_item_name,
        base_items.description as base_description,
        base_items.base_price as base_price,
        base_items.base_image_url as base_image_url,
        COALESCE(menu_items.custom_name, base_items.name) as display_name,
        COALESCE(menu_items.custom_description, base_items.description) as display_description,
        COALESCE(menu_items.custom_price, base_items.base_price) as display_price,
        COALESCE(menu_items.custom_image_url, base_items.base_image_url) as display_image_url
       FROM menu_items
       JOIN base_items ON menu_items.base_item_id = base_items.id
       WHERE menu_items.id = $1`,
        [id],
      );

      if (itemResult.rows.length === 0) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      const item = getRowOrNotFound(
        itemResult.rows,
        res,
        "Menu item not found",
      );

      if (!item) {
        throw new Error("Menu item not found");
      }

      // Get variations
      const variationsResult = await pool.query(
        `SELECT 
        miv.id,
        v.id as variation_id,
        v.name as variation_name,
        miv.price_adjustment,
        miv.is_default,
        miv.is_available
       FROM menu_item_variations miv
       JOIN variations v ON miv.variation_id = v.id
       WHERE miv.menu_item_id = $1
       ORDER BY miv.display_order`,
        [id],
      );

      // Get modifiers
      const modifiersResult = await pool.query(
        `SELECT 
        mim.id,
        m.id as modifier_id,
        m.name as modifier_name,
        mim.price,
        mim.max_quantity,
        mim.is_available
       FROM menu_item_modifiers mim
       JOIN modifiers m ON mim.modifier_id = m.id
       WHERE mim.menu_item_id = $1
       ORDER BY mim.display_order`,
        [id],
      );

      item.variations = variationsResult.rows;
      item.modifiers = modifiersResult.rows;

      return res.json({ success: true, data: item });
    } catch (err) {
      console.error("Get menu item error:", err);
      return res.status(500).json({ error: "Failed to retrieve menu item" });
    }
  },
);

// ========================================
// GET available options for menu item (based on base item)
// ========================================
router.get(
  "/base-item/:baseItemId/available-options",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ baseItemId: string }>,
    res: Response<APIResponse<AvailableOptionsForMenuItem>>,
  ) => {
    try {
      const { baseItemId } = req.params;

      // Get variation categories for this base item
      const variationCatsResult = await pool.query(
        `SELECT 
          vc.id as category_id,
          vc.name as category_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', v.id,
                'name', v.name,
                'default_price', v.default_price,
                'display_order', v.display_order
              ) ORDER BY v.display_order
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'
          ) as variations
         FROM base_item_variation_categories bivc
         JOIN variation_categories vc ON bivc.variation_category_id = vc.id
         LEFT JOIN variations v ON vc.id = v.category_id
         WHERE bivc.base_item_id = $1
         GROUP BY vc.id, vc.name
         ORDER BY vc.display_order`,
        [baseItemId],
      );

      // Get modifier categories for this base item
      const modifierCatsResult = await pool.query(
        `SELECT 
          mc.id as category_id,
          mc.name as category_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'name', m.name,
                'default_price', m.default_price,
                'display_order', m.display_order
              ) ORDER BY m.display_order
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as modifiers
         FROM base_item_modifier_categories bimc
         JOIN modifier_categories mc ON bimc.modifier_category_id = mc.id
         LEFT JOIN modifiers m ON mc.id = m.category_id
         WHERE bimc.base_item_id = $1
         GROUP BY mc.id, mc.name
         ORDER BY mc.display_order`,
        [baseItemId],
      );

      return res.json({
        success: true,
        data: {
          variation_categories: variationCatsResult.rows,
          modifier_categories: modifierCatsResult.rows,
        },
      });
    } catch (err) {
      console.error("Get available options error:", err);
      return res.status(500).json({
        error: "Failed to retrieve available options",
      });
    }
  },
);

// ========================================
// CREATE menu item(s) - single or batch
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateMenuItemBody>,
    res: Response<APIResponse<MenuItem | MenuItem[]>>,
  ) => {
    const client = await pool.connect();

    try {
      // Check if single item or array
      const { menu_category_id, items } = req.body;

      if (!menu_category_id) {
        return res.status(400).json({
          error: "menu_category_id is required",
        });
      }

      if (!items || items.length === 0) {
        return res.status(400).json({
          error: "items array is required and cannot be empty",
        });
      }

      const createdItems: MenuItem[] = [];

      await client.query("BEGIN");

      for (const itemData of items) {
        const {
          base_item_id,
          custom_name,
          custom_description,
          custom_price,
          custom_image_url,
          is_available = true,
          max_quantity_per_order = 10,
          variation_category_ids,
          modifier_category_ids,
        } = itemData;

        if (!base_item_id) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "base_item_id is required for all items",
          });
        }

        // Get max display_order for this category
        const maxOrderResult = await client.query(
          `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
           FROM menu_items 
           WHERE menu_category_id = $1`,
          [menu_category_id],
        );
        const displayOrder = maxOrderResult.rows[0].next_order;

        // Create menu item
        const itemResult = await client.query<MenuItem>(
          `INSERT INTO menu_items (
            menu_category_id,
            base_item_id,
            custom_name,
            custom_description,
            custom_price,
            custom_image_url,
            is_available,
            max_quantity_per_order,
            display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            menu_category_id,
            base_item_id,
            custom_name?.trim() || null,
            custom_description?.trim() || null,
            custom_price || null,
            custom_image_url || null,
            is_available,
            max_quantity_per_order,
            displayOrder,
          ],
        );

        const menuItem = getRowOrNotFound(
          itemResult.rows,
          res,
          "Failed to create menu item",
        );
        if (!menuItem) {
          await client.query("ROLLBACK");
          throw new Error("Failed to create menu item");
        }

        createdItems.push(menuItem);

        if (variation_category_ids && variation_category_ids.length > 0) {
          const variationsResult = await client.query(
            `SELECT id, category_id, default_price, display_order
             FROM variations
             WHERE category_id = ANY($1)
             ORDER BY category_id, display_order`,
            [variation_category_ids],
          );

          let displayOrderCounter = 1;
          for (const variation of variationsResult.rows) {
            await client.query(
              `INSERT INTO menu_item_variations (
                menu_item_id,
                variation_id,
                price_adjustment,
                is_default,
                is_available,
                display_order
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                menuItem.id,
                variation.id,
                variation.default_price || 0,
                false,
                true,
                displayOrderCounter++,
              ],
            );
          }
        }

        // Add ALL modifiers from selected categories
        if (modifier_category_ids && modifier_category_ids.length > 0) {
          const modifiersResult = await client.query(
            `SELECT id, category_id, default_price, display_order
             FROM modifiers
             WHERE category_id = ANY($1)
             ORDER BY category_id, display_order`,
            [modifier_category_ids],
          );

          let displayOrderCounter = 1;
          for (const modifier of modifiersResult.rows) {
            await client.query(
              `INSERT INTO menu_item_modifiers (
                menu_item_id,
                modifier_id,
                price,
                max_quantity,
                is_available,
                display_order
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                menuItem.id,
                modifier.id,
                modifier.default_price,
                5, // По замовчуванню max 5
                true,
                displayOrderCounter++,
              ],
            );
          }
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        data: createdItems,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create menu item(s) error:", err);
      return res.status(500).json({
        error: "Failed to create menu item(s)",
      });
    } finally {
      client.release();
    }
  },
);
// ========================================
// UPDATE menu item (all fields including variations and modifiers)
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateMenuItemBody>,
    res: Response<APIResponse<MenuItem>>,
  ) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const {
        custom_name,
        custom_description,
        custom_price,
        custom_image_url,
        is_available,
        max_quantity_per_order,
        variation_ids,
        modifier_ids,
      } = req.body;

      await client.query("BEGIN");

      // Update basic fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (custom_name !== undefined) {
        updates.push(`custom_name = $${paramCount++}`);
        values.push(custom_name?.trim() || null);
      }
      if (custom_description !== undefined) {
        updates.push(`custom_description = $${paramCount++}`);
        values.push(custom_description?.trim() || null);
      }
      if (custom_price !== undefined) {
        updates.push(`custom_price = $${paramCount++}`);
        values.push(custom_price || null);
      }
      if (custom_image_url !== undefined) {
        updates.push(`custom_image_url = $${paramCount++}`);
        values.push(custom_image_url || null);
      }
      if (is_available !== undefined) {
        updates.push(`is_available = $${paramCount++}`);
        values.push(is_available);
      }
      if (max_quantity_per_order !== undefined) {
        updates.push(`max_quantity_per_order = $${paramCount++}`);
        values.push(max_quantity_per_order);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(id);

        await client.query(
          `UPDATE menu_items SET ${updates.join(", ")} WHERE id = $${paramCount}`,
          values,
        );
      }

      // Update variations if provided
      if (variation_ids !== undefined) {
        // Delete existing variations
        await client.query(
          "DELETE FROM menu_item_variations WHERE menu_item_id = $1",
          [id],
        );

        // Add new variations
        if (variation_ids.length > 0) {
          // Get variation details with default_price
          const variationsResult = await client.query(
            `SELECT id, default_price
       FROM variations
       WHERE id = ANY($1)
       ORDER BY id`,
            [variation_ids],
          );

          for (let i = 0; i < variationsResult.rows.length; i++) {
            const variation = variationsResult.rows[i];
            await client.query(
              `INSERT INTO menu_item_variations (
          menu_item_id,
          variation_id,
          price_adjustment,
          is_default,
          is_available,
          display_order
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                variation.id,
                variation.default_price || 0,
                i === 0, // Перша варіація - default
                true,
                i,
              ],
            );
          }
        }
      }

      // Update modifiers if provided
      if (modifier_ids !== undefined) {
        // Delete existing modifiers
        await client.query(
          "DELETE FROM menu_item_modifiers WHERE menu_item_id = $1",
          [id],
        );

        // Add new modifiers
        if (modifier_ids.length > 0) {
          // Get modifier details with default_price
          const modifiersResult = await client.query(
            `SELECT id, default_price
       FROM modifiers
       WHERE id = ANY($1)
       ORDER BY id`,
            [modifier_ids],
          );

          for (let i = 0; i < modifiersResult.rows.length; i++) {
            const modifier = modifiersResult.rows[i];
            await client.query(
              `INSERT INTO menu_item_modifiers (
          menu_item_id,
          modifier_id,
          price,
          max_quantity,
          is_available,
          display_order
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                id,
                modifier.id,
                modifier.default_price,
                5, // Default max quantity
                true,
                i,
              ],
            );
          }
        }
      }

      // Get updated menu item
      const result = await client.query<MenuItem>(
        "SELECT * FROM menu_items WHERE id = $1",
        [id],
      );

      const menuItem = getRowOrNotFound(
        result.rows,
        res,
        "Menu item not found",
      );
      if (!menuItem) {
        await client.query("ROLLBACK");
        throw new Error("Menu item not found");
      }

      await client.query("COMMIT");

      return res.json({ success: true, data: menuItem });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update menu item error:", err);
      return res.status(500).json({ error: "Failed to update menu item" });
    } finally {
      client.release();
    }
  },
);

// ========================================
// REORDER items
// ========================================
router.put(
  "/reorder",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, ReorderItemsBody>,
    res: Response<APIResponse<{ message: string }> | ErrorResponse>,
  ) => {
    const client = await pool.connect();

    try {
      const { items } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }

      await client.query("BEGIN");

      for (const item of items) {
        await client.query(
          "UPDATE menu_items SET display_order = $1, updated_at = NOW() WHERE id = $2",
          [item.display_order, item.id],
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        data: { message: "Items reordered successfully" },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Reorder items error:", err);
      return res.status(500).json({ error: "Failed to reorder items" });
    } finally {
      client.release();
    }
  },
);

// ========================================
// DELETE menu item
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

      const result = await pool.query(
        "DELETE FROM menu_items WHERE id = $1 RETURNING id",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      return res.json({
        success: true,
        data: { message: "Menu item deleted successfully" },
      });
    } catch (err) {
      console.error("Delete menu item error:", err);
      return res.status(500).json({ error: "Failed to delete menu item" });
    }
  },
);

export default router;
