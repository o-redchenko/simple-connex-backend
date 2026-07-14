import {
  base_items,
  menu_items,
  menus,
  menu_categories,
  variations,
  modifiers,
  variation_categories,
  modifier_categories,
} from "@prisma/client";
import { PrismaToFront } from "./utils.types";

// ========================================
// Base Items
// ========================================

export type BaseItem = PrismaToFront<base_items>;

export type BaseItemWithCategories = BaseItem & {
  variation_categories: number[];
  modifier_categories: number[];
};

// ========================================
// Menu Items
// ========================================

export type MenuItem = Omit<
  PrismaToFront<menu_items>,
  "custom_price" | "display_order"
> & {
  custom_price: number | null;
  display_order: number;
};

export type MenuItemWithDetails = Omit<
  MenuItem,
  "custom_price" | "display_order"
> & {
  custom_price: number | null;
  display_order: number;
  base_item_name: string;
  base_description: string | null;
  base_price: number;
  base_image_url: string | null;
  display_name: string;
  display_description: string | null;
  display_price: number;
  display_image_url: string | null;
  variations?: MenuItemVariation[];
  modifiers?: MenuItemModifier[];
};

export type Menu = PrismaToFront<menus>;
export type MenuCategory = PrismaToFront<menu_categories>;

export type MenuWithStats = Menu & {
  category_count: number;
  item_count: number;
  location_count: number;
};

// ========================================
// Варіації та Модифікатори
// ========================================

export type Variation = PrismaToFront<variations>;
export type Modifier = PrismaToFront<modifiers>;

export type VariationCategory = PrismaToFront<variation_categories>;
export type ModifierCategory = PrismaToFront<modifier_categories>;

// ========================================
// Request Bodies (використовуємо Partial та Pick)
// ========================================

// Створення BaseItem: беремо потрібні поля, робимо деякі опціональними
export type CreateBaseItemBody = Pick<BaseItem, "name" | "base_price"> &
  Partial<Pick<BaseItem, "description" | "base_image_url">>;

// Оновлення BaseItem: все опціонально + наші масиви ID
export type UpdateBaseItemBody = Partial<CreateBaseItemBody> & {
  variation_category_ids?: number[];
  modifier_category_ids?: number[];
};

export type UpdateMenuItemBody = Partial<
  Omit<MenuItem, "id" | "created_at" | "updated_at">
> & {
  variation_ids?: number[];
  modifier_ids?: number[];
};

// ========================================
// MENU CATEGORY TYPES
// ========================================

export type MenuCategoryWithItems = MenuCategory & {
  item_count: number;
};

export type CreateCategoryBody = {
  menu_id: number;
  name: string;
  description?: string;
  image_url?: string;
};

export type UpdateCategoryBody = {
  name?: string;
  description?: string;
  image_url?: string;
  // Для реордерінгу товарів всередині категорії
  items?: Array<{
    id: number;
    display_order: number;
  }>;
};

// ========================================
// MENU ITEM TYPES
// ========================================

export type MenuItemVariation = {
  id: number;
  variation_id: number;
  variation_name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
};

export type MenuItemModifier = {
  id: number;
  modifier_id: number;
  modifier_name: string;
  price: number;
  max_quantity: number;
  is_available: boolean;
};

// ========================================
// REQUEST BODIES
// ========================================

export type CreateMenuItemBody = {
  menu_category_id: number;
  items: Array<{
    base_item_id: number;
    custom_name?: string;
    custom_description?: string;
    custom_price?: number;
    custom_image_url?: string;
    is_available?: boolean;
    max_quantity_per_order?: number;
    variation_category_ids?: number[]; // Категорії, з яких підтягнути всі варіації
    modifier_category_ids?: number[]; // Категорії, з яких підтягнути всі модифікатори
  }>;
};

export type ReorderItemsBody = {
  items: Array<{
    id: number;
    display_order: number;
  }>;
};

// ========================================
// HELPER TYPES FOR UI
// ========================================

export type AvailableOptionsForMenuItem = {
  variation_categories: Array<{
    category_id: number;
    category_name: string;
    variations: Array<{
      id: number;
      name: string;
      default_price: number;
      display_order: number;
    }>;
  }>;
  modifier_categories: Array<{
    category_id: number;
    category_name: string;
    modifiers: Array<{
      id: number;
      name: string;
      default_price: number;
      display_order: number;
    }>;
  }>;
};

export type UpdateMenuBody = {
  name?: string;
  description?: string;
  is_active?: boolean;
  location_ids?: number[];
  categories?: Array<{
    id: number;
    display_order: number;
  }>;
};

export type ModifierCategoryWithModifiers = ModifierCategory & {
  modifiers: Array<Modifier & { default_price: number }>;
};

export type ItemModifier = PrismaToFront<modifiers>;

export type ItemModifierWithCategory = ItemModifier & {
  category_name?: string;
};

// ========================================
// MODIFIER REQUEST TYPES
// ========================================

export type CreateModifierBody = {
  category_id: number;
  name: string;
  description?: string | null;
  default_price?: number;
  display_order?: number;
};

export type UpdateModifierBody = Partial<CreateModifierBody>;

export type VariationCategoryWithVariations = VariationCategory & {
  variations: Variation[];
};

export type BaseItemVariationCategory = {
  base_item_id: number;
  variation_category_id: number;
  display_order: number | null;
};

export type CreateVariationBody = {
  name: string;
  category_id: number;
  description?: string;
  default_price?: number;
  display_order?: number;
};

export type UpdateVariationBody = {
  [K in keyof Omit<CreateVariationBody, "category_id">]?:
    | CreateVariationBody[K]
    | null;
} & {
  category_id?: number;
};
