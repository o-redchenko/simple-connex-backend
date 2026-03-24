import "dotenv/config";
import express from "express";
import cors from "cors";
import locationRoutes from "./routes/locationRoutes";
import menuRoutes from "./routes/menuRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import orderRoutes from "./routes/orderRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import baseItemRoutes from "./routes/baseItemRoutes";
import menuItemsRoutes from "./routes/menuItemsRoutes";
import menuCategoryRoutes from "./routes/menuCategoryRoutes";
import variationsRoutes from "./routes/variationsRoutes";
import modifiersRoutes from "./routes/modifiersRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import variationCategoryRoutes from "./routes/variationCategoryRoutes";
import modifierCategoryRoutes from "./routes/modifierCategoryRoutes";
import pool from "./config/database";

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173", // Vite dev server
  ],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

app.use((req, _, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use("/api/menus", menuRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/base-items", baseItemRoutes);
app.use("/api/menu-items", menuItemsRoutes);
app.use("/api/menu-categories", menuCategoryRoutes);
app.use("/api/variations", variationsRoutes);
app.use("/api/modifiers", modifiersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/variation-categories", variationCategoryRoutes);
app.use("/api/modifier-categories", modifierCategoryRoutes);

app.get("/", (_, res) => {
  res.send("Hello World!");
});

app.get("/api/db-test", async (_, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected!",
      timestamp: result.rows[0].now,
    });
  } catch (err: Error | any) {
    res.status(500).json({ error: err.message });
  }
});

const server = app
  .listen(3000, () => {
    console.log("Server started on port 3000");
  })
  .on("error", (err) => {
    console.error("Server error:", err);
  });

export default server;
