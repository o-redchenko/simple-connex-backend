const jwt = require("jsonwebtoken");
const {
  authenticateToken,
  isAdmin,
  isAdminOrStaff,
} = require("../middleware/auth");

process.env.JWT_SECRET = "test-secret-key";

describe("Auth Middleware", () => {
  describe("authenticateToken", () => {
    it("should authenticate valid token", () => {
      const token = jwt.sign(
        { userId: 1, email: "test@example.com", role: "customer" },
        process.env.JWT_SECRET,
      );

      const req = {
        headers: { authorization: `Bearer ${token}` },
      };
      const res = {};
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it("should reject missing token", () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. No token provided.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should reject invalid token", () => {
      const req = {
        headers: { authorization: "Bearer invalid-token" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isAdmin", () => {
    it("should allow admin users", () => {
      const req = { user: { role: "admin" } };
      const res = {};
      const next = jest.fn();

      isAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block non-admin users", () => {
      const req = { user: { role: "customer" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      isAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Access denied. Admin only.",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isAdminOrStaff", () => {
    it("should allow admin users", () => {
      const req = { user: { role: "admin" } };
      const res = {};
      const next = jest.fn();

      isAdminOrStaff(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should allow staff users", () => {
      const req = { user: { role: "staff" } };
      const res = {};
      const next = jest.fn();

      isAdminOrStaff(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block customer users", () => {
      const req = { user: { role: "customer" } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      isAdminOrStaff(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
