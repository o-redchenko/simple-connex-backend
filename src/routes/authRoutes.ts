import { Router, Response } from "express";
import pool from "../config/database";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/auth";
import {
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidRole,
} from "../utils/validation";
import {
  AuthRequest,
  ErrorResponse,
  JWTPayload,
  LoginBody,
  RegisterBody,
  SafeUser,
  SuccessResponse,
} from "@/types";

const router = Router();

// Register new user
router.post(
  "/register",
  async (
    req: AuthRequest<{}, {}, RegisterBody>,
    res: Response<
      SuccessResponse<{ user: SafeUser; token: string }> | ErrorResponse
    >,
  ) => {
    try {
      const { email, password, first_name, last_name, role } = req.body;

      // Validate email
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      // Validate password
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }

      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Validate names
      if (first_name && !isValidName(first_name)) {
        return res
          .status(400)
          .json({ error: "First name must be between 2 and 50 characters" });
      }

      if (last_name && !isValidName(last_name)) {
        return res
          .status(400)
          .json({ error: "Last name must be between 2 and 50 characters" });
      }

      // Validate role
      if (role && !isValidRole(role)) {
        return res
          .status(400)
          .json({ error: "Invalid role. Must be: customer, staff, or admin" });
      }

      // Check if user already exists
      const existingUser = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email.toLowerCase()],
      );

      if (existingUser.rows.length > 0) {
        return res
          .status(400)
          .json({ error: "User with this email already exists" });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await pool.query(
        "INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role, created_at",
        [
          email.toLowerCase(),
          hashedPassword,
          first_name,
          last_name,
          role || "customer",
        ],
      );

      const newUser = result.rows[0];

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined");
      }

      const tokenPayload: JWTPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "24h" });

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: newUser,
          token: token,
        },
      });
    } catch (err) {
      console.error("Registration error:", err);
      return res
        .status(500)
        .json({ error: "An error occurred during registration" });
    }
  },
);

// Login user
router.post(
  "/login",
  async (
    req: AuthRequest<{}, {}, LoginBody>,
    res: Response<
      SuccessResponse<{ user: SafeUser; token: string }> | ErrorResponse
    >,
  ) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find user
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email.toLowerCase(),
      ]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = result.rows[0];

      // Check if password field exists
      if (!user.password) {
        return res.status(401).json({
          error: "Account not properly configured. Please contact support.",
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined");
      }

      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "24h" });

      const { password: _, ...safeUser } = user;

      return res.json({
        success: true,
        message: "Login successful",
        data: {
          user: safeUser as SafeUser,
          token: token,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "An error occurred during login" });
    }
  },
);

router.get(
  "/profile",
  authenticateToken,
  async (
    req: AuthRequest,
    res: Response<SuccessResponse<SafeUser> | ErrorResponse>,
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "User not authenticated",
        });
      }

      const result = await pool.query(
        "SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1",
        [req.user.userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Get profile error:", err);
      return res.status(500).json({
        error: "Failed to retrieve profile",
      });
    }
  },
);

export default router;
