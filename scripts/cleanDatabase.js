require("dotenv").config();
const { Pool } = require("pg");
const readline = require("readline");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ========================================
// Clean Database Function
// ========================================
const cleanDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log("\n⚠️  WARNING: This will delete ALL data from the database!");
    console.log("Tables to be cleared:");
    console.log("  - users");
    console.log("  - locations");
    console.log("  - menus & menu items");
    console.log("  - orders & order items");
    console.log("  - transactions");
    console.log("  - variations & modifiers");
    console.log("  - and all related data\n");

    // Confirmation prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question("Are you sure you want to continue? (yes/no): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "yes") {
      console.log("\n❌ Operation cancelled");
      await pool.end();
      process.exit(0);
    }

    console.log("\n🗑️  Clearing database...\n");

    await client.query("BEGIN");

    // Order matters due to foreign key constraints
    await client.query("TRUNCATE TABLE transactions CASCADE");
    await client.query("TRUNCATE TABLE order_item_modifiers CASCADE");
    await client.query("TRUNCATE TABLE order_item_variations CASCADE");
    await client.query("TRUNCATE TABLE order_items CASCADE");
    await client.query("TRUNCATE TABLE orders CASCADE");
    await client.query("TRUNCATE TABLE menu_item_modifiers CASCADE");
    await client.query("TRUNCATE TABLE menu_item_variations CASCADE");
    await client.query("TRUNCATE TABLE menu_items CASCADE");
    await client.query("TRUNCATE TABLE menu_categories CASCADE");
    await client.query("TRUNCATE TABLE location_menus CASCADE");
    await client.query("TRUNCATE TABLE menus CASCADE");
    await client.query("TRUNCATE TABLE locations CASCADE");
    await client.query("TRUNCATE TABLE base_items CASCADE");
    await client.query("TRUNCATE TABLE modifiers CASCADE");
    await client.query("TRUNCATE TABLE modifier_categories CASCADE");
    await client.query("TRUNCATE TABLE variations CASCADE");
    await client.query("TRUNCATE TABLE variation_categories CASCADE");
    await client.query("TRUNCATE TABLE users CASCADE");

    await client.query("COMMIT");

    console.log("✅ Database cleaned successfully!\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error cleaning database:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

cleanDatabase();
