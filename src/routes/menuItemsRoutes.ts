import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  MenuItem,
  MenuItemWithDetails,
  APIResponse,
  CreateMenuItemBody,
} from "../types";

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
      const categoryId = parseInt(req.params.categoryId);

      const items = await prisma.menu_items.findMany({
        where: { menu_category_id: categoryId },
        include: {
          base_items: true,
        },
        orderBy: { display_order: "asc" },
      });

      const data: MenuItemWithDetails[] = items.map((item) => {
        const customPrice = item.custom_price
          ? Number(item.custom_price)
          : null;
        const basePrice = Number(item.base_items.base_price);

        return {
          ...item,
          custom_price: customPrice,
          display_order: item.display_order ?? 0,
          base_item_name: item.base_items.name,
          base_description: item.base_items.description,
          base_price: basePrice,
          base_image_url: item.base_items.base_image_url,
          display_name: item.custom_name || item.base_items.name,
          display_description:
            item.custom_description || item.base_items.description,
          display_price: customPrice ?? basePrice,
          display_image_url:
            item.custom_image_url || item.base_items.base_image_url,
          created_at: item.created_at ?? new Date(),
          updated_at: item.updated_at ?? new Date(),
        };
      });

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get menu items error:", err);
      return res.status(500).json({ error: "Failed to retrieve menu items" });
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
      const id = parseInt(req.params.id);

      const item = await prisma.menu_items.findUnique({
        where: { id },
        include: {
          base_items: true,
          menu_item_variations: {
            include: { variations: true },
            orderBy: { display_order: "asc" },
          },
          menu_item_modifiers: {
            include: { modifiers: true },
            orderBy: { display_order: "asc" },
          },
        },
      });

      if (!item) return res.status(404).json({ error: "Menu item not found" });

      const data: MenuItemWithDetails = {
        ...item,
        custom_price: item.custom_price ? Number(item.custom_price) : null,
        display_order: item.display_order ?? 0,
        base_item_name: item.base_items.name,
        base_description: item.base_items.description,
        base_price: Number(item.base_items.base_price),
        base_image_url: item.base_items.base_image_url,
        display_name: item.custom_name || item.base_items.name,
        display_description:
          item.custom_description || item.base_items.description,
        display_price: Number(item.custom_price || item.base_items.base_price),
        display_image_url:
          item.custom_image_url || item.base_items.base_image_url,
        variations: item.menu_item_variations.map((v) => ({
          id: v.id,
          variation_id: v.variation_id,
          variation_name: v.variations.name,
          price_adjustment: Number(v.price_adjustment),
          is_default: v.is_default ?? false,
          is_available: v.is_available ?? true,
        })),
        modifiers: item.menu_item_modifiers.map((m) => ({
          id: m.id,
          modifier_id: m.modifier_id,
          modifier_name: m.modifiers.name,
          price: Number(m.price),
          max_quantity: m.max_quantity ?? 1,
          is_available: m.is_available || true,
        })),
      };

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get menu item error:", err);
      return res.status(500).json({ error: "Failed to retrieve menu item" });
    }
  },
);

// ========================================
// CREATE menu item(s) - Batch Transaction
// ========================================
router.post(
  "/",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{}, {}, CreateMenuItemBody>,
    res: Response<APIResponse<MenuItem[]>>,
  ) => {
    try {
      const { menu_category_id, items } = req.body;

      if (!menu_category_id || !items?.length) {
        return res
          .status(400)
          .json({ error: "Category ID and items are required" });
      }

      const createdItems = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const itemData of items) {
          const aggregate = await tx.menu_items.aggregate({
            where: { menu_category_id },
            _max: { display_order: true },
          });
          const nextOrder = (aggregate._max.display_order || 0) + 1;

          const newItem = await tx.menu_items.create({
            data: {
              menu_category_id,
              base_item_id: itemData.base_item_id,
              custom_name: itemData.custom_name?.trim(),
              custom_description: itemData.custom_description?.trim(),
              custom_price: itemData.custom_price,
              custom_image_url: itemData.custom_image_url,
              is_available: itemData.is_available ?? true,
              max_quantity_per_order: itemData.max_quantity_per_order ?? 10,
              display_order: nextOrder,
            },
          });

          if (itemData.variation_category_ids?.length) {
            const vars = await tx.variations.findMany({
              where: { category_id: { in: itemData.variation_category_ids } },
            });

            await tx.menu_item_variations.createMany({
              data: vars.map((v, index) => ({
                menu_item_id: newItem.id,
                variation_id: v.id,
                price_adjustment: v.default_price || 0,
                is_default: false,
                is_available: true,
                display_order: index + 1,
              })),
            });
          }

          if (itemData.modifier_category_ids?.length) {
            const mods = await tx.modifiers.findMany({
              where: { category_id: { in: itemData.modifier_category_ids } },
            });

            await tx.menu_item_modifiers.createMany({
              data: mods.map((m, index) => ({
                menu_item_id: newItem.id,
                modifier_id: m.id,
                price: m.default_price || 0,
                max_quantity: 5,
                is_available: true,
                display_order: index + 1,
              })),
            });
          }

          results.push(newItem);
        }
        return results;
      });

      const formattedItems = createdItems.map((item) => ({
        ...item,
        custom_price: item.custom_price ? Number(item.custom_price) : null,
        display_order: item.display_order ?? 0,
      }));

      return res.status(201).json({ success: true, data: formattedItems });
    } catch (err) {
      console.error("Batch create error:", err);
      return res.status(500).json({ error: "Failed to create menu items" });
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
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Cascade delete на рівні БД має бути налаштований,
      // але для безпеки Prisma робимо видалення в транзакції
      await prisma.$transaction([
        prisma.menu_item_variations.deleteMany({ where: { menu_item_id: id } }),
        prisma.menu_item_modifiers.deleteMany({ where: { menu_item_id: id } }),
        prisma.menu_items.delete({ where: { id } }),
      ]);

      return res.json({
        success: true,
        data: { message: "Deleted successfully" },
      });
    } catch (err) {
      return res.status(500).json({ error: "Delete failed" });
    }
  },
);

export default router;
