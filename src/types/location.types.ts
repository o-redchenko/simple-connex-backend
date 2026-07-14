import { locations } from "@prisma/client";
import { PrismaToFront } from "./utils.types";

// ========================================
// JSON Structures (Для типізації Json полів)
// ========================================

export type DaySchedule = {
  open: string; // "08:00"
  close: string; // "20:00"
  closed: boolean;
};

export type HoursOfOperation = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export type LocationType =
  | "dine_in_only"
  | "takeout_only"
  | "dine_in_and_takeout";

// ========================================
// Location Entity (Prisma-based)
// ========================================

// Використовуємо Omit, щоб замінити сирі Json типи на наші структуровані інтерфейси
export type Location = Omit<
  PrismaToFront<locations>,
  "hours_of_operation" | "images" | "location_type"
> & {
  location_type: LocationType;
  hours_of_operation: HoursOfOperation | null;
  images: string[]; // Масив URL-адрес
};

// ========================================
// Request Bodies
// ========================================

// Для створення беремо все, крім системних полів
export type CreateLocationBody = Omit<
  Location,
  "id" | "created_at" | "updated_at"
>;

// Для оновлення робимо всі поля CreateLocationBody опціональними
export type UpdateLocationBody = Partial<CreateLocationBody>;
