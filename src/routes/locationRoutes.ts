import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  Location,
  CreateLocationBody,
  UpdateLocationBody,
  APIResponse,
  LocationType,
  HoursOfOperation,
} from "../types";
import { locations } from "@prisma/client";

const router = Router();

const mapPrismaLocation = (loc: locations): Location => ({
  ...loc,
  phone: loc.phone ?? "",
  is_active: loc.is_active ?? true,
  location_type: loc.location_type as LocationType,
  hours_of_operation: loc.hours_of_operation as HoursOfOperation | null,
  images: (loc.images as string[]) || [],
  created_at: loc.created_at ?? new Date(),
  updated_at: loc.updated_at ?? new Date(),
});

// ========================================
// GET all locations
// ========================================
router.get(
  "/",
  authenticateToken,
  async (_req: AuthRequest, res: Response<APIResponse<Location[]>>) => {
    try {
      const rawLocations = await prisma.locations.findMany({
        orderBy: { name: "asc" },
      });

      const data: Location[] = rawLocations.map(mapPrismaLocation);

      return res.json({ success: true, data });
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
      const rawLoc = await prisma.locations.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!rawLoc) return res.status(404).json({ error: "Not found" });

      const data: Location = mapPrismaLocation(rawLoc);

      return res.json({ success: true, data });
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
        phone,
        is_active = true,
        hours_of_operation,
        show_in_app = true,
        delivery_available = false,
        location_type = "dine_in_and_takeout",
        image_url,
        images = [],
      } = req.body;

      if (!name || !address || !city || !phone) {
        return res.status(400).json({
          error: "name, address, city, state, zip_code, and phone are required",
        });
      }

      const rawLocation = await prisma.locations.create({
        data: {
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          phone: phone.trim(),
          is_active,
          hours_of_operation: hours_of_operation || undefined, // Prisma сама засейвить об'єкт як JSON
          show_in_app,
          delivery_available,
          location_type,
          image_url: image_url || null,
          images: images || [],
        },
      });

      const data: Location = mapPrismaLocation(rawLocation);

      return res.status(201).json({ success: true, data });
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
      const id = parseInt(req.params.id);

      const reqBody: any = { ...req.body };

      const stringFields = [
        "name",
        "address",
        "city",
        "state",
        "zip_code",
        "phone",
        "email",
      ];
      stringFields.forEach((field) => {
        if (typeof reqBody[field] === "string")
          reqBody[field] = reqBody[field].trim();
      });

      const rawLocation = await prisma.locations.update({
        where: { id },
        data: {
          ...reqBody,
          updated_at: new Date(),
        },
      });

      const data: Location = mapPrismaLocation(rawLocation);

      return res.json({ success: true, data });
    } catch (err: any) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Location not found" });
      }
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
      await prisma.locations.delete({
        where: { id: parseInt(req.params.id) },
      });

      return res.json({
        success: true,
        data: { message: "Location deleted successfully" },
      });
    } catch (err: any) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Location not found" });
      }
      console.error("Delete location error:", err);
      return res.status(500).json({ error: "Failed to delete location" });
    }
  },
);

export default router;
