import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

const isCloudDb = connectionString?.includes("supabase");
const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString,
  ssl: isCloudDb || isProduction ? { rejectUnauthorized: false } : undefined,
});

export default pool;
