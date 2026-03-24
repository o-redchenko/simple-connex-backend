import express, { Response } from "express";
import pool from "../config/database";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateModifierBody,
  ItemModifier,
  UpdateModifierBody,
} from "@/types";
import { getRowOrFailed, getRowOrNotFound } from "@/utils/response";

const router = express.Router();

// Get all modifiers
router.get(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (_req: AuthRequest, res: Response<APIResponse<ItemModifier[]>>) => {
    try {
      const result = await pool.query<ItemModifier>(
        "SELECT * FROM modifiers ORDER BY name",
      );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (err) {
      console.error("Get modifiers error:", err);
      return res.status(500).json({ error: "Failed to retrieve modifiers" });
    }
  },
);

// Create modifier
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateModifierBody>,
    res: Response<APIResponse<ItemModifier>>,
  ) => {
    try {
      const { name, description, default_price } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await pool.query<ItemModifier>(
        "INSERT INTO modifiers (name, description, default_price) VALUES ($1, $2, $3) RETURNING *",
        [name, description, default_price || 0],
      );

      const modifier = getRowOrFailed(
        result.rows,
        res,
        "Failed to create modifier",
      );

      if (!modifier) {
        return;
      }

      return res.status(201).json({
        success: true,
        message: "Modifier created successfully",
        data: modifier,
      });
    } catch (err) {
      console.error("Create modifier error:", err);
      return res.status(500).json({ error: "Failed to create modifier" });
    }
  },
);

// Update modifier
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
      const { name, description, default_price } = req.body;

      const result = await pool.query<ItemModifier>(
        `UPDATE modifiers 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           default_price = COALESCE($3, default_price)
       WHERE id = $4 
       RETURNING *`,
        [name, description, default_price, id],
      );

      const updatedModifier = getRowOrNotFound(
        result.rows,
        res,
        "Modifier not found",
      );

      if (!updatedModifier) {
        return;
      }

      return res.json({
        success: true,
        message: "Modifier updated successfully",
        data: updatedModifier,
      });
    } catch (err) {
      console.error("Update modifier error:", err);
      return res.status(500).json({ error: "Failed to update modifier" });
    }
  },
);

// Delete modifier
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

      const result = await pool.query<{ id: number; name: string }>(
        "DELETE FROM modifiers WHERE id = $1 RETURNING *",
        [id],
      );

      const deletedModifier = getRowOrNotFound(
        result.rows,
        res,
        "Modifier not found",
      );

      if (!deletedModifier) {
        return;
      }

      return res.json({
        success: true,
        data: deletedModifier,
        message: "Modifier deleted successfully",
      });
    } catch (err) {
      console.error("Delete modifier error:", err);
      return res.status(500).json({ error: "Failed to delete modifier" });
    }
  },
);

export default router;
