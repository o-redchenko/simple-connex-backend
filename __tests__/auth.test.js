const request = require("supertest");
const express = require("express");
const authRoutes = require("../routes/authRoutes");
const pool = require("../config/database");

// Mock the database
jest.mock("../config/database");

// Create a test app
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

// Set JWT secret for testing
process.env.JWT_SECRET = "test-secret-key";

describe("Auth Routes", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      // Mock database responses
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user - returns empty
        .mockResolvedValueOnce({
          // Create user - returns new user
          rows: [
            {
              id: 1,
              email: "test@example.com",
              first_name: "Test",
              last_name: "User",
              role: "customer",
              created_at: new Date(),
            },
          ],
        });

      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "StrongPass123",
        first_name: "Test",
        last_name: "User",
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("test@example.com");
      expect(response.body.data.token).toBeDefined();
    });

    it("should fail with weak password", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "weak",
        first_name: "Test",
        last_name: "User",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Password must be at least");
    });

    it("should fail with invalid email", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "invalid-email",
        password: "StrongPass123",
        first_name: "Test",
        last_name: "User",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid email address");
    });

    it("should fail if user already exists", async () => {
      // Mock existing user found
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: "existing@example.com" }],
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "existing@example.com",
        password: "StrongPass123",
        first_name: "Test",
        last_name: "User",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("User with this email already exists");
    });

    it("should fail without required fields", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        // missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Password is required");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      // Mock finding user with hashed password
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("StrongPass123", 10);

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: "test@example.com",
            password: hashedPassword,
            first_name: "Test",
            last_name: "User",
            role: "customer",
          },
        ],
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "StrongPass123",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe("test@example.com");
    });

    it("should fail with wrong password", async () => {
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("CorrectPass123", 10);

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            email: "test@example.com",
            password: hashedPassword,
            role: "customer",
          },
        ],
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "WrongPass123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should fail with non-existent user", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "StrongPass123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should fail without email or password", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        // missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email and password are required");
    });
  });
});
