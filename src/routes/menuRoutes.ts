import { Router, Response } from "express";
import prisma from "../config/prisma";
import { authenticateToken, isAdminOrStaff } from "../middleware/auth";
import {
  AuthRequest,
  Menu,
  MenuWithStats,
  UpdateMenuBody,
  APIResponse,
} from "../types";

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
      const menus = await prisma.menus.findMany({
        include: {
          _count: {
            select: {
              menu_categories: true,
              location_menus: true,
            },
          },
          // Для підрахунку загальної кількості страв у меню
          menu_categories: {
            select: {
              _count: { select: { menu_items: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const data: MenuWithStats[] = menus.map((m) => ({
        ...m,
        category_count: m._count.menu_categories,
        location_count: m._count.location_menus,
        // Сумуємо кількість страв з усіх категорій
        item_count: m.menu_categories.reduce(
          (acc, cat) => acc + cat._count.menu_items,
          0,
        ),
      }));

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Get menus error:", err);
      return res.status(500).json({ error: "Failed to retrieve menus" });
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
      const id = parseInt(req.params.id);
      const menu = await prisma.menus.findUnique({ where: { id } });

      if (!menu) return res.status(404).json({ error: "Menu not found" });

      return res.json({ success: true, data: menu });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve menu" });
    }
  },
);

// ========================================
// GET locations for a specific menu
// GET /api/menus/:id/locations
// ========================================
router.get(
  "/:id/locations",
  authenticateToken,
  isAdminOrStaff,
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid menu ID" });
      }

      // 1. Перевіряємо існування меню
      const menu = await prisma.menus.findUnique({
        where: { id },
      });

      if (!menu) {
        return res.status(404).json({ error: "Menu not found" });
      }

      // 2. Отримуємо всі локації, для яких активне це меню (is_active: true)
      const locations = await prisma.locations.findMany({
        where: {
          location_menus: {
            some: {
              menu_id: id,
              is_active: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return res.json({ success: true, data: locations });
    } catch (err: any) {
      console.error("Get menu locations error:", err);
      return res.status(500).json({
        error: err.message || "Failed to retrieve locations for menu",
      });
    }
  },
);

// ========================================
// UPDATE menu (Transaction)
// ========================================
router.put(
  "/:id",
  authenticateToken,
  isAdminOrStaff,
  async (
    req: AuthRequest<{ id: string }, {}, UpdateMenuBody>,
    res: Response<APIResponse<Menu>>,
  ) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, is_active, location_ids, categories } =
        req.body;

      const updatedMenu = await prisma.$transaction(async (tx) => {
        // 1. Оновлюємо базові поля
        const menu = await tx.menus.update({
          where: { id },
          data: {
            name: name?.trim(),
            description: description?.trim(),
            is_active,
            updated_at: new Date(),
          },
        });

        // 2. Оновлюємо локації (якщо передані)
        if (location_ids !== undefined) {
          // Перевірка, чи не зайняті локації іншими меню (крім цього)
          if (location_ids.length > 0) {
            const occupied = await tx.location_menus.findFirst({
              where: {
                location_id: { in: location_ids },
                menu_id: { not: id },
              },
            });

            if (occupied) {
              throw new Error(
                `Location ${occupied.location_id} already has another menu assigned`,
              );
            }
          }

          await tx.location_menus.deleteMany({ where: { menu_id: id } });
          await tx.location_menus.createMany({
            data: location_ids.map((locId) => ({
              location_id: locId,
              menu_id: id,
              is_active: true,
            })),
          });
        }

        // 3. Оновлюємо порядок категорій
        if (categories?.length) {
          for (const cat of categories) {
            await tx.menu_categories.update({
              where: { id: cat.id },
              data: { display_order: cat.display_order },
            });
          }
        }

        return menu;
      });

      return res.json({ success: true, data: updatedMenu });
    } catch (err: any) {
      console.error("Update menu error:", err);
      return res.status(400).json({ error: err.message || "Update failed" });
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
  async (req: AuthRequest<{ id: string }>, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await prisma.menus.delete({ where: { id } });
      return res.json({
        success: true,
        data: { message: "Menu deleted successfully" },
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete menu" });
    }
  },
);

export default router;
