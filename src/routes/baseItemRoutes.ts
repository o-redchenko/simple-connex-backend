import { Router, Response } from "express";
import prisma from "../config/prisma";
import { base_items, Prisma } from "@prisma/client"; // Імпортуємо типи Prisma
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  BaseItemWithCategories,
  APIResponse,
  UpdateBaseItemBody,
} from "../types";

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
      const items = await prisma.base_items.findMany({
        include: {
          base_item_variation_categories: {
            select: { variation_category_id: true },
          },
          base_item_modifier_categories: {
            select: { modifier_category_id: true },
          },
        },
        orderBy: { name: "asc" },
      });

      const formattedItems = items.map((item) => ({
        ...item,
        // Перетворюємо Decimal у number для відповідності типу BaseItem
        base_price: item.base_price.toNumber(),
        variation_categories: item.base_item_variation_categories
          .map((c) => c.variation_category_id)
          .filter((id): id is number => id !== null),
        modifier_categories: item.base_item_modifier_categories
          .map((c) => c.modifier_category_id)
          .filter((id): id is number => id !== null),
      }));

      return res.json({ success: true, data: formattedItems });
    } catch (err) {
      console.error("Get base items error:", err);
      return res.status(500).json({ error: "Failed to retrieve base items" });
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
    res: Response<APIResponse<base_items>>,
  ) => {
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

      const newItem = await prisma.base_items.create({
        data: {
          name,
          description,
          base_price: new Prisma.Decimal(base_price),
          base_image_url,
          base_item_variation_categories: {
            create:
              variation_category_ids?.map((id) => ({
                variation_category_id: id,
              })) || [],
          },
          base_item_modifier_categories: {
            create:
              modifier_category_ids?.map((id) => ({
                modifier_category_id: id,
              })) || [],
          },
        },
      });

      return res.status(201).json({ success: true, data: newItem });
    } catch (err) {
      console.error("Create base item error:", err);
      return res.status(500).json({ error: "Failed to create base item" });
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
    req: AuthRequest<{ id: string }, {}, UpdateBaseItemBody>,
    res: Response<APIResponse<BaseItemWithCategories>>,
  ) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

      const {
        name,
        description,
        base_price,
        base_image_url,
        variation_category_ids,
        modifier_category_ids,
      } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // Оновлюємо основну модель
        await tx.base_items.update({
          where: { id },
          data: {
            name,
            description,
            base_price:
              base_price !== undefined
                ? new Prisma.Decimal(base_price)
                : undefined,
            base_image_url,
            updated_at: new Date(),
          },
        });

        // Синхронізація категорій варіацій
        if (variation_category_ids !== undefined) {
          await tx.base_item_variation_categories.deleteMany({
            where: { base_item_id: id },
          });
          if (variation_category_ids.length > 0) {
            await tx.base_item_variation_categories.createMany({
              data: variation_category_ids.map((catId) => ({
                base_item_id: id,
                variation_category_id: catId,
              })),
            });
          }
        }

        // Синхронізація категорій модифікаторів
        if (modifier_category_ids !== undefined) {
          await tx.base_item_modifier_categories.deleteMany({
            where: { base_item_id: id },
          });
          if (modifier_category_ids.length > 0) {
            await tx.base_item_modifier_categories.createMany({
              data: modifier_category_ids.map((catId) => ({
                base_item_id: id,
                modifier_category_id: catId,
              })),
            });
          }
        }

        // Отримуємо фінальний об'єкт
        return tx.base_items.findUniqueOrThrow({
          where: { id },
          include: {
            base_item_variation_categories: {
              select: { variation_category_id: true },
            },
            base_item_modifier_categories: {
              select: { modifier_category_id: true },
            },
          },
        });
      });

      const formatted = {
        ...result,
        base_price: result.base_price.toNumber(),
        variation_categories: result.base_item_variation_categories
          .map((c) => c.variation_category_id)
          .filter((v): v is number => v !== null),
        modifier_categories: result.base_item_modifier_categories
          .map((c) => c.modifier_category_id)
          .filter((v): v is number => v !== null),
      };

      return res.json({ success: true, data: formatted });
    } catch (err) {
      console.error("Update error:", err);
      return res.status(500).json({ error: "Failed to update base item" });
    }
  },
);

export default router;
