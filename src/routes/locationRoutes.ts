import { Router, Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  Location,
  CreateLocationBody,
  UpdateLocationBody,
  APIResponse,
} from "../types";
import { getRowOrNotFound } from "@/utils/response";

const router = Router();

// ========================================
// GET all locations
// ========================================
router.get(
  "/",
  authenticateToken,
  async (_req: AuthRequest, res: Response<APIResponse<Location[]>>) => {
    try {
      const result = await pool.query<Location>(
        "SELECT * FROM locations ORDER BY name",
      );

      return res.json({ success: true, data: result.rows });
    } catch (err) {
      console.error("Get locations error:", err);
      return res.status(500).json({ error: "Failed to retrieve locations" });
    }
  },
);

// ========================================
// GET single location
// ========================================
router.get(
  "/:id",
  authenticateToken,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<Location>>,
  ) => {
    try {
      const { id } = req.params;

      const result = await pool.query<Location>(
        "SELECT * FROM locations WHERE id = $1",
        [id],
      );

      const location = getRowOrNotFound(result.rows, res, "Location not found");
      if (!location) {
        throw new Error("Location not found");
      }

      return res.json({ success: true, data: location });
    } catch (err) {
      console.error("Get location error:", err);
      return res.status(500).json({ error: "Failed to retrieve location" });
    }
  },
);

// ========================================
// CREATE location
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateLocationBody>,
    res: Response<APIResponse<Location>>,
  ) => {
    try {
      const {
        name,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        is_active = true,
        hours_of_operation,
        show_in_app = true,
        delivery_available = false,
        location_type = "dine_in_and_takeout",
        image_url,
        images = [],
      } = req.body;

      if (!name || !address || !city || !state || !zip_code || !phone) {
        return res.status(400).json({
          error: "name, address, city, state, zip_code, and phone are required",
        });
      }

      const result = await pool.query<Location>(
        `INSERT INTO locations (
          name, 
          address, 
          city, 
          state, 
          zip_code, 
          phone, 
          email,
          is_active,
          hours_of_operation,
          show_in_app,
          delivery_available,
          location_type,
          image_url,
          images
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          name.trim(),
          address.trim(),
          city.trim(),
          state.trim(),
          zip_code.trim(),
          phone.trim(),
          email?.trim() || null,
          is_active,
          hours_of_operation ? JSON.stringify(hours_of_operation) : null,
          show_in_app,
          delivery_available,
          location_type,
          image_url || null,
          JSON.stringify(images),
        ],
      );

      const location = getRowOrNotFound(
        result.rows,
        res,
        "Failed to create location",
      );
      if (!location) {
        throw new Error("Failed to create location");
      }

      return res.status(201).json({ success: true, data: location });
    } catch (err) {
      console.error("Create location error:", err);
      return res.status(500).json({ error: "Failed to create location" });
    }
  },
);

// ========================================
// UPDATE location
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateLocationBody>,
    res: Response<APIResponse<Location>>,
  ) => {
    try {
      const { id } = req.params;
      const {
        name,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        is_active,
        hours_of_operation,
        show_in_app,
        delivery_available,
        location_type,
        image_url,
        images,
      } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name.trim());
      }
      if (address !== undefined) {
        updates.push(`address = $${paramCount++}`);
        values.push(address.trim());
      }
      if (city !== undefined) {
        updates.push(`city = $${paramCount++}`);
        values.push(city.trim());
      }
      if (state !== undefined) {
        updates.push(`state = $${paramCount++}`);
        values.push(state.trim());
      }
      if (zip_code !== undefined) {
        updates.push(`zip_code = $${paramCount++}`);
        values.push(zip_code.trim());
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramCount++}`);
        values.push(phone.trim());
      }
      if (email !== undefined) {
        updates.push(`email = $${paramCount++}`);
        values.push(email?.trim() || null);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(is_active);
      }
      if (hours_of_operation !== undefined) {
        updates.push(`hours_of_operation = $${paramCount++}`);
        values.push(
          hours_of_operation ? JSON.stringify(hours_of_operation) : null,
        );
      }
      if (show_in_app !== undefined) {
        updates.push(`show_in_app = $${paramCount++}`);
        values.push(show_in_app);
      }
      if (delivery_available !== undefined) {
        updates.push(`delivery_available = $${paramCount++}`);
        values.push(delivery_available);
      }
      if (location_type !== undefined) {
        updates.push(`location_type = $${paramCount++}`);
        values.push(location_type);
      }
      if (image_url !== undefined) {
        updates.push(`image_url = $${paramCount++}`);
        values.push(image_url || null);
      }
      if (images !== undefined) {
        updates.push(`images = $${paramCount++}`);
        values.push(JSON.stringify(images));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await pool.query<Location>(
        `UPDATE locations SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
        values,
      );

      const location = getRowOrNotFound(result.rows, res, "Location not found");
      if (!location) {
        throw new Error("Location not found");
      }

      return res.json({ success: true, data: location });
    } catch (err) {
      console.error("Update location error:", err);
      return res.status(500).json({ error: "Failed to update location" });
    }
  },
);

// ========================================
// DELETE location
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
        "DELETE FROM locations WHERE id = $1 RETURNING id",
        [id],
      );

      const deletedLocation = getRowOrNotFound(
        result.rows,
        res,
        "Location not found",
      );
      if (!deletedLocation) {
        throw new Error("Location not found");
      }

      return res.json({
        success: true,
        data: { message: "Location deleted successfully" },
      });
    } catch (err) {
      console.error("Delete location error:", err);
      return res.status(500).json({ error: "Failed to delete location" });
    }
  },
);

export default router;
