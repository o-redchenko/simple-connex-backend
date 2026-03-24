import { Request } from "express";

export type UserRole = "customer" | "staff" | "admin";

export type JWTPayload = {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};

export type AuthRequest<
  P = {},
  ResBody = any,
  ReqBody = any,
  ReqQuery = {},
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  user?: JWTPayload;
};

export type User = {
  id: number;
  email: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  balance: number;
  created_at: Date;
};

export type SafeUser = Omit<User, "password">;

export type RegisterBody = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type UpdateRoleBody = {
  role: UserRole;
};
