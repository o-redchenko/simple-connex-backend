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

export type Location = {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  hours_of_operation: HoursOfOperation | null;
  show_in_app: boolean;
  delivery_available: boolean;
  location_type: LocationType;
  image_url: string | null;
  images: string[]; // Array of image URLs
  created_at: Date;
  updated_at: Date;
};

export type CreateLocationBody = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email?: string;
  is_active?: boolean;
  hours_of_operation?: HoursOfOperation;
  show_in_app?: boolean;
  delivery_available?: boolean;
  location_type?: LocationType;
  image_url?: string;
  images?: string[];
};

export type UpdateLocationBody = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
  hours_of_operation?: HoursOfOperation;
  show_in_app?: boolean;
  delivery_available?: boolean;
  location_type?: LocationType;
  image_url?: string;
  images?: string[];
};
