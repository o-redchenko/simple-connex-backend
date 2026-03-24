import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  Menu,
  MenuWithStats,
  Location,
  UpdateMenuBody,
  APIResponse,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

const router = Router();

// ========================================
// GET all menus with stats
// ========================================
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<MenuWithStats[]>>) => {
    try {
      const result = await pool.query<MenuWithStats>(
        `SELECT 
        menus.*,
        COUNT(DISTINCT menu_categories.id) as category_count,
        COUNT(DISTINCT menu_items.id) as item_count,
        COUNT(DISTINCT location_menus.location_id) as location_count
       FROM menus
       LEFT JOIN menu_categories ON menus.id = menu_categories.menu_id
       LEFT JOIN menu_items ON menu_categories.id = menu_items.menu_category_id
       LEFT JOIN location_menus ON menus.id = location_menus.menu_id
       GROUP BY menus.id
       ORDER BY menus.name`,
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get menus error:", err);
      res.status(500).json({ error: "Failed to retrieve menus" });
    }
  },
);

// ========================================
// GET single menu by ID
// ========================================
router.get(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<Menu>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query<Menu>(
        "SELECT * FROM menus WHERE id = $1",
        [id],
      );

      const menu = getRowOrNotFound(result.rows, res, "Menu not found");
      if (!menu) {
        throw new Error("Menu not found");
      }

      return res.json({ success: true, data: menu });
    } catch (err) {
      console.error("Get menu error:", err);
      return res.status(500).json({ error: "Failed to retrieve menu" });
    }
  },
);

// ========================================
// GET menu locations
// ========================================
router.get(
  "/:id/locations",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<{ id: number }[]>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query<Location>(
        `SELECT locations.id
       FROM locations
       JOIN location_menus ON locations.id = location_menus.location_id
       WHERE location_menus.menu_id = $1
       ORDER BY locations.name`,
        [id],
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get menu locations error:", err);
      res.status(500).json({ error: "Failed to retrieve menu locations" });
    }
  },
);

// ========================================
// CREATE menu
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, { name: string; description?: string }>,
    res: Response<APIResponse<Menu>>,
  ) => {
    try {
      const { name, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Menu name is required" });
      }

      const result = await pool.query<Menu>(
        `INSERT INTO menus (name, description, is_active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), description?.trim() || null, true],
      );

      const menu = getRowOrNotFound(result.rows, res, "Failed to create menu");
      if (!menu) {
        throw new Error("Failed to create menu");
      }

      return res.status(201).json({ success: true, data: menu });
    } catch (err) {
      console.error("Create menu error:", err);
      return res.status(500).json({ error: "Failed to create menu" });
    }
  },
);

// ========================================
// UPDATE menu
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateMenuBody>,
    res: Response<APIResponse<Menu>>,
  ) => {
    const client = await pool.connect();

    try {
      const { id } = req.params;
      const { name, description, is_active, location_ids, categories } =
        req.body;

      await client.query("BEGIN");

      // Update menu basic info
      const menuUpdates: string[] = [];
      const menuValues: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        menuUpdates.push(`name = $${paramCount++}`);
        menuValues.push(name);
      }
      if (description !== undefined) {
        menuUpdates.push(`description = $${paramCount++}`);
        menuValues.push(description);
      }
      if (is_active !== undefined) {
        menuUpdates.push(`is_active = $${paramCount++}`);
        menuValues.push(is_active);
      }

      if (menuUpdates.length > 0) {
        menuUpdates.push(`updated_at = NOW()`);
        menuValues.push(id);

        const result = await client.query<Menu>(
          `UPDATE menus SET ${menuUpdates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
          menuValues,
        );

        const updatedMenu = getRowOrNotFound(
          result.rows,
          res,
          "Menu not found",
        );
        if (!updatedMenu) {
          await client.query("ROLLBACK");
          throw new Error("Menu not found");
        }
      }

      // Update locations if provided
      if (location_ids !== undefined) {
        // Remove all existing location assignments
        await client.query("DELETE FROM location_menus WHERE menu_id = $1", [
          id,
        ]);

        // Add new location assignments
        if (location_ids.length > 0) {
          for (const locationId of location_ids) {
            // Check if location already has a different menu
            const existingResult = await client.query(
              "SELECT menu_id FROM location_menus WHERE location_id = $1",
              [locationId],
            );

            if (existingResult.rows.length > 0) {
              await client.query("ROLLBACK");
              return res.status(400).json({
                error: `Location ${locationId} already has a menu assigned`,
              });
            }

            await client.query(
              `INSERT INTO location_menus (location_id, menu_id, is_active)
               VALUES ($1, $2, true)`,
              [locationId, id],
            );
          }
        }
      }

      // Update category order if provided
      if (categories && categories.length > 0) {
        for (const category of categories) {
          await client.query(
            "UPDATE menu_categories SET display_order = $1, updated_at = NOW() WHERE id = $2",
            [category.display_order, category.id],
          );
        }
      }

      await client.query("COMMIT");

      // Fetch final menu state
      const finalResult = await pool.query<Menu>(
        "SELECT * FROM menus WHERE id = $1",
        [id],
      );

      const finalMenu = getRowOrNotFound(
        finalResult.rows,
        res,
        "Menu not found",
      );
      if (!finalMenu) {
        throw new Error("Menu not found");
      }

      return res.json({ success: true, data: finalMenu });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update menu error:", err);
      return res.status(500).json({ error: "Failed to update menu" });
    } finally {
      client.release();
    }
  },
);

// ========================================
// DELETE menu
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
        "DELETE FROM menus WHERE id = $1 RETURNING id",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Menu not found" });
      }

      return res.json({
        success: true,
        data: { message: "Menu deleted successfully" },
      });
    } catch (err) {
      console.error("Delete menu error:", err);
      return res.status(500).json({ error: "Failed to delete menu" });
    }
  },
);

export default router;
