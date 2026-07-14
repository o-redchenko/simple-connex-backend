require("dotenv").config();
const pool = require("../src/config/database");

const extendLocations = async () => {
  const client = await pool.connect();

  try {
    console.log("🏢 Extending locations table...\n");

    await client.query("BEGIN");

    // Add new columns
    await client.query(`
      ALTER TABLE locations 
      ADD COLUMN IF NOT EXISTS hours_of_operation JSONB,
      ADD COLUMN IF NOT EXISTS show_in_app BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'dine_in_and_takeout',
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'
    `);
    console.log("✅ Added new columns");

    // Add check constraint
    await client.query(`
      ALTER TABLE locations
      DROP CONSTRAINT IF EXISTS locations_location_type_check
    `);

    await client.query(`
      ALTER TABLE locations
      ADD CONSTRAINT locations_location_type_check 
      CHECK (location_type IN ('dine_in_only', 'takeout_only', 'dine_in_and_takeout'))
    `);
    console.log("✅ Added location_type constraint");

    // Set default hours for existing locations
    const defaultHours = {
      monday: { open: "08:00", close: "20:00", closed: false },
      tuesday: { open: "08:00", close: "20:00", closed: false },
      wednesday: { open: "08:00", close: "20:00", closed: false },
      thursday: { open: "08:00", close: "20:00", closed: false },
      friday: { open: "08:00", close: "22:00", closed: false },
      saturday: { open: "09:00", close: "22:00", closed: false },
      sunday: { open: "10:00", close: "18:00", closed: false },
    };

    await client.query(
      `UPDATE locations 
       SET hours_of_operation = $1 
       WHERE hours_of_operation IS NULL`,
      [JSON.stringify(defaultHours)],
    );
    console.log("✅ Set default hours for existing locations");

    await client.query("COMMIT");

    console.log("\n✅ Locations table extended successfully!\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error extending locations:", err);
  } finally {
    client.release();
    await pool.end();
  }
};

extendLocations();
