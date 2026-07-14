import { Router, Response } from "express";
import prisma from "../config/prisma"; // Міняємо pool на prisma
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/auth";
import { isValidEmail, isValidPassword } from "../utils/validation";
import {
  AuthRequest,
  ErrorResponse,
  JWTPayload,
  LoginBody,
  RegisterBody,
  SafeUser,
  SuccessResponse,
  UserRole,
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

      // Validate email and password
      if (!email || !isValidEmail(email))
        return res.status(400).json({ error: "Invalid email address" });
      if (!password)
        return res.status(400).json({ error: "Password is required" });
      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid)
        return res.status(400).json({ error: passwordValidation.message });

      // Check if user already exists
      const existingUser = await prisma.users.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res
          .status(400)
          .json({ error: "User with this email already exists" });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await prisma.users.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          first_name,
          last_name,
          role: (role as any) || "customer",
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
        },
      });

      // JWT logic
      const jwtSecret = process.env.JWT_SECRET!;
      const tokenPayload: JWTPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role as UserRole,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "24h" });

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: { user: newUser as SafeUser, token },
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

      console.log("Login request:", { email, password });

      if (!email || !password)
        return res
          .status(400)
          .json({ error: "Email and password are required" });

      // Find user
      const user = await prisma.users.findUnique({
        where: { email: email.toLowerCase() },
      });

      console.log("User found:", user);

      if (!user || !user.password) {
        console.log("User not found or password is null");
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);

      console.log("Password verification result:", validPassword);

      if (!validPassword)
        return res.status(401).json({ error: "Invalid email or password" });

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET!;
      const tokenPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "7d" });

      // Remove password from object
      const safeUser = {
        ...user,
        password: "_",
        balance: user.balance ? Number(user.balance) : 0,
      };

      return res.json({
        success: true,
        message: "Login successful",
        data: { user: safeUser as SafeUser, token },
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
      if (!req.user)
        return res.status(401).json({ error: "User not authenticated" });

      const user = await prisma.users.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        success: true,
        data: user as SafeUser,
      });
    } catch (err) {
      console.error("Get profile error:", err);
      return res.status(500).json({ error: "Failed to retrieve profile" });
    }
  },
);

export default router;
