import { ORDER_STATUS_VALUES, OrderStatus } from "@/types";

type PasswordValidationResult = {
  valid: boolean;
  message: string;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): PasswordValidationResult => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }
  return { valid: true, message: "Password is valid" };
};

export const isValidName = (name: string): string | boolean => {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
};

export const isValidRole = (role: string) => {
  const validRoles = ["customer", "staff", "admin"];
  return validRoles.includes(role);
};

export const isValidOrderStatus = (status: string): status is OrderStatus => {
  return ORDER_STATUS_VALUES.includes(status as OrderStatus);
};
