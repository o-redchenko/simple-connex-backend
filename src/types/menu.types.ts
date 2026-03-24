// Base types
export type Menu = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type MenuWithStats = Menu & {
  category_count: number;
  item_count: number;
  location_count: number;
};

export type MenuCategory = {
  id: number;
  menu_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type MenuCategoryWithItems = MenuCategory & {
  item_count: number;
};

export type MenuItem = {
  id: number;
  menu_category_id: number;
  base_item_id: number;
  custom_name: string | null;
  custom_description: string | null;
  custom_price: number | null;
  custom_image_url: string | null;
  is_available: boolean;
  max_quantity_per_order: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type MenuItemWithDetails = MenuItem & {
  base_item_name: string;
  base_description: string | null;
  base_price: number;
  base_image_url: string | null;
  display_name: string;
  display_description: string | null;
  display_price: number;
  display_image_url: string | null;
  variations: ItemVariation[];
  modifiers: ItemModifier[];
};

export type ItemVariation = {
  id?: number;
  variation_id: number;
  variation_name: string;
  price_adjustment: number;
  is_default: boolean;
  is_available?: boolean;
};

export type ItemModifier = {
  id?: number;
  modifier_id: number;
  modifier_name: string;
  price: number;
  max_quantity?: number;
  is_available?: boolean;
};

// Request types
export type UpdateMenuBody = {
  name?: string;
  description?: string;
  is_active?: boolean;
  location_ids?: number[];
  categories?: Array<{ id: number; display_order: number }>;
};

export type UpdateMenuLocationsBody = {
  location_ids: number[];
};

export type CreateCategoryBody = {
  menu_id: number;
  name: string;
  description?: string;
  image_url?: string;
  display_order?: number;
};

export type UpdateCategoryBody = {
  name?: string;
  description?: string;
  image_url?: string;
  items?: Array<{ id: number; display_order: number }>;
};

export type ReorderCategoriesBody = {
  categories: Array<{ id: number; display_order: number }>;
};

export type ReorderItemsBody = {
  items: Array<{ id: number; display_order: number }>;
};

export type UpdateMenuItemBody = {
  custom_name?: string;
  custom_description?: string;
  custom_price?: number;
  custom_image_url?: string;
  is_available?: boolean;
  max_quantity_per_order?: number;
  variation_ids?: number[];
  modifier_ids?: number[];
};

export type BaseItem = {
  id: number;
  name: string;
  description: string | null;
  base_price: number;
  base_image_url: string | null;
  created_at: Date;
};

export type MenuItemVariation = {
  id?: number;
  menu_item_id: number;
  variation_id: number;
  price_adjustment: number;
  is_default: boolean;
  is_available?: boolean;
  display_order?: number;
  created_at?: Date;
};

export type MenuItemModifier = {
  id?: number;
  menu_item_id: number;
  modifier_id: number;
  price: number;
  max_quantity?: number;
  is_available?: boolean;
  display_order?: number;
  created_at?: Date;
};

// ========================================
// Variations
// ========================================
export type Variation = {
  id: number;
  category_id: number;
  name: string;
  default_price: number;
  display_order: number;
  created_at: Date;
};

export type VariationCategory = {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: Date;
};

export type VariationCategoryWithVariations = VariationCategory & {
  variations: Variation[];
};

export type VariationWithCategory = ItemVariation & {
  category_id: number | null;
  category_name?: string | null;
};

// ========================================
// Modifiers
// ========================================
export type Modifier = {
  id: number;
  category_id: number;
  name: string;
  default_price: number;
  display_order: number;
  created_at: Date;
};

export type ModifierCategory = {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: Date;
};

export type ModifierCategoryWithModifiers = ModifierCategory & {
  modifiers: Modifier[];
};

export type ModifierWithCategory = ItemModifier & {
  category_id: number | null;
  category_name?: string | null;
};

// ========================================
// Request Bodies
// ========================================
export type CreateVariationCategoryBody = {
  name: string;
  description?: string;
  display_order?: number;
};

export type CreateModifierCategoryBody = {
  name: string;
  description?: string;
  display_order?: number;
};

export type CreateVariationBody = {
  name: string;
  description?: string;
  default_price?: number;
  category_id: number;
};

export type CreateModifierBody = {
  name: string;
  description?: string;
  default_price: number;
  category_id: number;
};

export type UpdateVariationBody = {
  name?: string;
  description?: string;
  default_price?: number;
  category_id?: number;
};

export type UpdateModifierBody = {
  name?: string;
  description?: string;
  default_price?: number;
  category_id?: number;
};

export type DeleteVariationBody = {
  id: number;
};

export type DeleteModifierBody = {
  id: number;
};

export type DeleteVariationRes = Variation;
export type DeleteModifierRes = Modifier;

export type CreateBaseItemBody = {
  name: string;
  description?: string;
  base_price: number;
  base_image_url?: string;
};

export type UpdateBaseItemBody = {
  name?: string;
  description?: string;
  base_price?: number;
  base_image_url?: string;
  variation_category_ids?: number[];
  modifier_category_ids?: number[];
};

export type BaseItemWithCategories = BaseItem & {
  variation_categories: number[];
  modifier_categories: number[];
};

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
    variation_category_ids: number[];
    modifier_category_ids: number[];
  }>;
};

export type VariationCategoryWithAvailability = {
  category_id: number;
  category_name: string;
  category_description: string | null;
  variations: Array<{
    id: number;
    name: string;
    display_order: number;
  }>;
  selected_variations: Array<{
    menu_item_variation_id: number;
    variation_id: number;
    price_adjustment: number;
    is_default: boolean;
    is_available: boolean;
  }>;
};

export type ModifierCategoryWithAvailability = {
  category_id: number;
  category_name: string;
  category_description: string | null;
  modifiers: Array<{
    id: number;
    name: string;
    default_price: number;
    display_order: number;
  }>;
  selected_modifiers: Array<{
    menu_item_modifier_id: number;
    modifier_id: number;
    price: number;
    max_quantity: number;
    is_available: boolean;
  }>;
};
