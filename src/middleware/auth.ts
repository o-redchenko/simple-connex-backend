import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { Response, NextFunction } from "express";
import { AuthRequest, JWTPayload } from "@/types";

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void | Response => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ error: "JWT secret not found." });
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({
        error: "Token expired. Please login again.",
      });
    }

    if (err instanceof JsonWebTokenError) {
      return res.status(403).json({
        error: "Invalid token",
      });
    }

    return res.status(403).json({
      error: "Token verification failed",
    });
  }
};

export const validateUserRole = (
  req: AuthRequest,
  res: Response,
  allowedRoles: ReadonlyArray<"admin" | "staff" | "customer">,
): boolean => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }

  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      error: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
    });
    return false;
  }

  return true;
};

// Check if user is admin
export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void | Response => {
  if (validateUserRole(req, res, ["admin"])) {
    next();
  }
};

// Check if user is admin or staff
export const isAdminOrStaff = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void | Response => {
  if (validateUserRole(req, res, ["admin", "staff"])) {
    next();
  }
};
