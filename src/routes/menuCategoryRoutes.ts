import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  APIResponse,
  AuthRequest,
  CreateCategoryBody,
  MenuCategory,
  UpdateCategoryBody,
  MenuCategoryWithItems,
} from "../types";

const router = Router();

// ========================================
// GET all categories for a menu
// ========================================
router.get(
  "/menu/:menuId",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ menuId: string }>,
    res: Response<APIResponse<MenuCategoryWithItems[]>>,
  ) => {
    try {
      const menuId = parseInt(req.params.menuId);

      const categories = await prisma.menu_categories.findMany({
        where: { menu_id: menuId },
        include: {
          _count: {
            select: { menu_items: true },
          },
        },
        orderBy: { display_order: "asc" },
      });

      const data: MenuCategoryWithItems[] = categories.map((cat) => ({
        ...cat,
        item_count: cat._count.menu_items,
      }));

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get categories error:", err);
      return res.status(500).json({ error: "Failed to retrieve categories" });
    }
  },
);

// ========================================
// GET single category
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
      const category = await prisma.menu_categories.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

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

      if (!name?.trim() || !menu_id) {
        return res.status(400).json({ error: "Name and Menu ID are required" });
      }

      // Розрахунок наступного display_order через агрегацію
      const aggregate = await prisma.menu_categories.aggregate({
        where: { menu_id },
        _max: { display_order: true },
      });

      const displayOrder = (aggregate._max.display_order || 0) + 1;

      const newCategory = await prisma.menu_categories.create({
        data: {
          menu_id,
          name: name.trim(),
          description: description?.trim() || null,
          image_url: image_url || null,
          display_order: displayOrder,
        },
      });

      return res.status(201).json({ success: true, data: newCategory });
    } catch (err) {
      console.error("Create category error:", err);
      return res.status(500).json({ error: "Failed to create category" });
    }
  },
);

// ========================================
// UPDATE category (with Items Reordering)
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateCategoryBody>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    try {
      const categoryId = parseInt(req.params.id);
      const { name, description, image_url, items } = req.body;

      // Використовуємо транзакцію для оновлення категорії та її товарів
      const updatedCategory = await prisma.$transaction(async (tx) => {
        // 1. Оновлюємо основні поля категорії
        const category = await tx.menu_categories.update({
          where: { id: categoryId },
          data: {
            name: name?.trim(),
            description: description?.trim(),
            image_url,
            updated_at: new Date(),
          },
        });

        // 2. Якщо передано масив товарів для реордерінгу
        if (items && items.length > 0) {
          for (const item of items) {
            await tx.menu_items.update({
              where: { id: item.id },
              data: { display_order: item.display_order },
            });
          }
        }

        return category;
      });

      return res.json({ success: true, data: updatedCategory });
    } catch (err: any) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Category not found" });
      console.error("Update category error:", err);
      return res.status(500).json({ error: "Failed to update category" });
    }
  },
);

// ========================================
// DELETE category (with Cascade Cleanup)
// ========================================
router.delete(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }>,
    res: Response<APIResponse<MenuCategory>>,
  ) => {
    try {
      const categoryId = parseInt(req.params.id);

      const deletedCategory = await prisma.$transaction(async (tx) => {
        // Отримуємо всі ID товарів цієї категорії для видалення залежностей
        const items = await tx.menu_items.findMany({
          where: { menu_category_id: categoryId },
          select: { id: true },
        });
        const itemIds = items.map((i) => i.id);

        if (itemIds.length > 0) {
          // Видаляємо варіації та модифікатори
          await tx.menu_item_variations.deleteMany({
            where: { menu_item_id: { in: itemIds } },
          });
          await tx.menu_item_modifiers.deleteMany({
            where: { menu_item_id: { in: itemIds } },
          });
          // Видаляємо самі товари
          await tx.menu_items.deleteMany({
            where: { menu_category_id: categoryId },
          });
        }

        // Видаляємо категорію
        return await tx.menu_categories.delete({
          where: { id: categoryId },
        });
      });

      return res.json({
        success: true,
        data: deletedCategory,
        // @ts-ignore (якщо ми хочемо додати кастомне повідомлення в APIResponse)
        message: "Category and its items deleted successfully",
      });
    } catch (err: any) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Category not found" });
      console.error("Delete category error:", err);
      return res.status(500).json({ error: "Failed to delete category" });
    }
  },
);

export default router;
