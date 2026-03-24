require("dotenv").config();
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ========================================
// Helper Functions
// ========================================
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomPrice = (min, max) =>
  (Math.random() * (max - min) + min).toFixed(2);

const randomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
};

const randomElement = (arr) => arr[randomInt(0, arr.length - 1)];

// ========================================
// Seed Data
// ========================================
const seedDatabase = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🌱 Starting database seed...\n");

    // ========================================
    // 1. Create Users
    // ========================================
    console.log("👥 Creating users...");

    const hashedPassword = await bcrypt.hash("Password123!", 10);
    const users = [];

    // Admin
    const adminResult = await client.query(
      `INSERT INTO users (email, password, first_name, last_name, role, balance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        "admin@coffee.com",
        hashedPassword,
        "Admin",
        "User",
        "admin",
        1000,
        new Date("2025-01-01"),
      ],
    );
    users.push(adminResult.rows[0].id);

    // Staff
    const staffResult = await client.query(
      `INSERT INTO users (email, password, first_name, last_name, role, balance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        "staff@coffee.com",
        hashedPassword,
        "Staff",
        "Member",
        "staff",
        500,
        new Date("2025-01-15"),
      ],
    );
    users.push(staffResult.rows[0].id);

    // Customers (50 users spread over last 60 days)
    const firstNames = [
      "John",
      "Jane",
      "Mike",
      "Sarah",
      "David",
      "Emma",
      "Chris",
      "Lisa",
      "Tom",
      "Anna",
    ];
    const lastNames = [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
    ];

    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 50; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      const balance = parseFloat(randomPrice(0, 500));
      const createdAt = randomDate(sixtyDaysAgo, now);

      const result = await client.query(
        `INSERT INTO users (email, password, first_name, last_name, role, balance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          email,
          hashedPassword,
          firstName,
          lastName,
          "customer",
          balance,
          createdAt,
        ],
      );
      users.push(result.rows[0].id);
    }

    console.log(`✅ Created ${users.length} users\n`);

    // ========================================
    // 2. Create Locations
    // ========================================
    console.log("📍 Creating locations...");

    const locations = [
      {
        name: "Downtown Coffee",
        address: "123 Main St",
        city: "New York",
        phone: "+1-555-0101",
      },
      {
        name: "Uptown Cafe",
        address: "456 Park Ave",
        city: "New York",
        phone: "+1-555-0102",
      },
      {
        name: "Westside Branch",
        address: "789 West End Ave",
        city: "New York",
        phone: "+1-555-0103",
      },
      {
        name: "Airport Lounge",
        address: "Terminal 1, JFK Airport",
        city: "Queens",
        phone: "+1-555-0104",
      },
    ];

    const locationIds = [];
    for (const loc of locations) {
      const result = await client.query(
        `INSERT INTO locations (name, address, city, phone, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [loc.name, loc.address, loc.city, loc.phone, true],
      );
      locationIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${locationIds.length} locations\n`);

    // ========================================
    // 3. Create Variation & Modifier Categories
    // ========================================
    console.log("📁 Creating variation & modifier categories...");

    const varCatResult = await client.query(
      `INSERT INTO variation_categories (name, description, display_order)
       VALUES ('Size', 'Beverage sizes', 1),
              ('Temperature', 'Hot or cold options', 2)
       RETURNING id`,
    );

    const modCatResult = await client.query(
      `INSERT INTO modifier_categories (name, description, display_order)
       VALUES ('Syrups', 'Flavor syrups', 1),
              ('Milk Alternatives', 'Dairy and non-dairy options', 2),
              ('Extra Shots', 'Additional espresso shots', 3),
              ('Toppings', 'Whipped cream, cinnamon, etc', 4)
       RETURNING id`,
    );

    console.log(`✅ Created categories\n`);

    // ========================================
    // 4. Create Variations
    // ========================================
    console.log("🔄 Creating variations...");

    const variationIds = [];
    const variations = [
      { name: "Small (12oz)", category_id: varCatResult.rows[0].id },
      { name: "Medium (16oz)", category_id: varCatResult.rows[0].id },
      { name: "Large (20oz)", category_id: varCatResult.rows[0].id },
      { name: "Hot", category_id: varCatResult.rows[1].id },
      { name: "Iced", category_id: varCatResult.rows[1].id },
    ];

    for (const v of variations) {
      const result = await client.query(
        `INSERT INTO variations (name, category_id)
         VALUES ($1, $2)
         RETURNING id`,
        [v.name, v.category_id],
      );
      variationIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${variationIds.length} variations\n`);

    // ========================================
    // 5. Create Modifiers
    // ========================================
    console.log("➕ Creating modifiers...");

    const modifierIds = [];
    const modifiers = [
      {
        name: "Vanilla Syrup",
        default_price: 0.5,
        category_id: modCatResult.rows[0].id,
      },
      {
        name: "Caramel Syrup",
        default_price: 0.5,
        category_id: modCatResult.rows[0].id,
      },
      {
        name: "Hazelnut Syrup",
        default_price: 0.5,
        category_id: modCatResult.rows[0].id,
      },
      {
        name: "Oat Milk",
        default_price: 0.75,
        category_id: modCatResult.rows[1].id,
      },
      {
        name: "Almond Milk",
        default_price: 0.75,
        category_id: modCatResult.rows[1].id,
      },
      {
        name: "Soy Milk",
        default_price: 0.75,
        category_id: modCatResult.rows[1].id,
      },
      {
        name: "Extra Shot",
        default_price: 0.75,
        category_id: modCatResult.rows[2].id,
      },
      {
        name: "Whipped Cream",
        default_price: 0.5,
        category_id: modCatResult.rows[3].id,
      },
      {
        name: "Cinnamon",
        default_price: 0,
        category_id: modCatResult.rows[3].id,
      },
    ];

    for (const m of modifiers) {
      const result = await client.query(
        `INSERT INTO modifiers (name, default_price, category_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [m.name, m.default_price, m.category_id],
      );
      modifierIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${modifierIds.length} modifiers\n`);

    // ========================================
    // 6. Create Base Items
    // ========================================
    console.log("☕ Creating base items...");

    const baseItems = [
      {
        name: "Latte",
        description: "Espresso with steamed milk",
        base_price: 4.0,
      },
      {
        name: "Cappuccino",
        description: "Espresso with foam",
        base_price: 4.0,
      },
      {
        name: "Americano",
        description: "Espresso with hot water",
        base_price: 3.5,
      },
      {
        name: "Mocha",
        description: "Espresso with chocolate",
        base_price: 4.5,
      },
      { name: "Cold Brew", description: "Smooth cold coffee", base_price: 4.5 },
      { name: "Espresso", description: "Pure espresso shot", base_price: 2.5 },
      {
        name: "Croissant",
        description: "Buttery French pastry",
        base_price: 3.5,
      },
      {
        name: "Blueberry Muffin",
        description: "Fresh baked muffin",
        base_price: 3.0,
      },
      { name: "Bagel", description: "With cream cheese", base_price: 3.5 },
      {
        name: "Avocado Toast",
        description: "On sourdough bread",
        base_price: 6.5,
      },
    ];

    const baseItemIds = [];
    for (const item of baseItems) {
      const result = await client.query(
        `INSERT INTO base_items (name, description, base_price)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [item.name, item.description, item.base_price],
      );
      baseItemIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${baseItemIds.length} base items\n`);

    // ========================================
    // 7. Create Menus
    // ========================================
    console.log("📋 Creating menus...");

    const menuResult = await client.query(
      `INSERT INTO menus (name, description, is_active)
       VALUES ('Full Menu', 'Complete menu with all items', true)
       RETURNING id`,
    );
    const menuId = menuResult.rows[0].id;

    console.log(`✅ Created menu\n`);

    // ========================================
    // 8. Create Menu Categories
    // ========================================
    console.log("🗂️ Creating menu categories...");

    const categories = [
      {
        name: "Hot Coffee",
        description: "Classic hot coffee beverages",
        order: 1,
      },
      {
        name: "Cold Coffee",
        description: "Refreshing cold coffee drinks",
        order: 2,
      },
      { name: "Pastries", description: "Fresh baked goods", order: 3 },
      { name: "Food", description: "Breakfast and lunch items", order: 4 },
    ];

    const categoryIds = [];
    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO menu_categories (menu_id, name, description, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [menuId, cat.name, cat.description, cat.order],
      );
      categoryIds.push(result.rows[0].id);
    }

    console.log(`✅ Created ${categoryIds.length} categories\n`);

    // ========================================
    // 9. Create Menu Items & Link Variations/Modifiers
    // ========================================
    console.log("🍽️ Creating menu items...");

    // Hot Coffee items (Latte, Cappuccino, Americano, Mocha, Espresso)
    for (let i = 0; i < 5; i++) {
      const result = await client.query(
        `INSERT INTO menu_items (menu_category_id, base_item_id, is_available, max_quantity_per_order, display_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [categoryIds[0], baseItemIds[i], true, 5, i + 1],
      );
      const menuItemId = result.rows[0].id;

      // Add size variations (Small, Medium, Large)
      for (let j = 0; j < 3; j++) {
        await client.query(
          `INSERT INTO menu_item_variations (menu_item_id, variation_id, price_adjustment, is_default, is_available, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [menuItemId, variationIds[j], j * 0.5, j === 1, true, j + 1],
        );
      }

      // Add modifiers (Syrups, Milk, Extra Shot, Toppings)
      await client.query(
        `INSERT INTO menu_item_modifiers (menu_item_id, modifier_id, price, max_quantity, is_available, display_order)
         VALUES ($1, $2, $3, $4, $5, $6),
                ($1, $7, $8, $9, $10, $11),
                ($1, $12, $13, $14, $15, $16),
                ($1, $17, $18, $19, $20, $21)`,
        [
          menuItemId,
          modifierIds[0],
          0.5,
          2,
          true,
          1,
          modifierIds[3],
          0.75,
          1,
          true,
          2,
          modifierIds[6],
          0.75,
          3,
          true,
          3,
          modifierIds[7],
          0.5,
          1,
          true,
          4,
        ],
      );
    }

    // Cold Coffee (Cold Brew)
    const coldBrewResult = await client.query(
      `INSERT INTO menu_items (menu_category_id, base_item_id, is_available, max_quantity_per_order, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [categoryIds[1], baseItemIds[4], true, 5, 1],
    );
    const coldBrewId = coldBrewResult.rows[0].id;

    // Add size variations
    for (let j = 0; j < 3; j++) {
      await client.query(
        `INSERT INTO menu_item_variations (menu_item_id, variation_id, price_adjustment, is_default, is_available, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [coldBrewId, variationIds[j], j * 0.5, j === 1, true, j + 1],
      );
    }

    // Pastries (Croissant, Muffin, Bagel)
    for (let i = 6; i < 9; i++) {
      await client.query(
        `INSERT INTO menu_items (menu_category_id, base_item_id, is_available, max_quantity_per_order, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [categoryIds[2], baseItemIds[i], true, 10, i - 5],
      );
    }

    // Food (Avocado Toast)
    await client.query(
      `INSERT INTO menu_items (menu_category_id, base_item_id, is_available, max_quantity_per_order, display_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [categoryIds[3], baseItemIds[9], true, 5, 1],
    );

    console.log(`✅ Created menu items with variations & modifiers\n`);

    // ========================================
    // 10. Link Menus to Locations
    // ========================================
    console.log("🔗 Linking menus to locations...");

    for (const locId of locationIds) {
      await client.query(
        `INSERT INTO location_menus (location_id, menu_id, is_active)
         VALUES ($1, $2, $3)`,
        [locId, menuId, true],
      );
    }

    console.log(`✅ Linked menu to all locations\n`);

    // ========================================
    // 11. Create Orders & Transactions (Last 30 days)
    // ========================================
    console.log("🛒 Creating orders and transactions...");

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const statuses = [
      "pending",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ];

    // GET ACTUAL MENU ITEM IDS FROM DATABASE
    const menuItemsResult = await client.query(
      "SELECT id FROM menu_items WHERE is_available = true",
    );

    if (menuItemsResult.rows.length === 0) {
      console.error("❌ No menu items found. Cannot create orders.");
      await client.query("ROLLBACK");
      return;
    }

    const menuItemIdsForOrders = menuItemsResult.rows.map((row) => row.id);

    console.log(
      `   Found ${menuItemIdsForOrders.length} menu items for orders`,
    );

    // Create 200 orders spread over last 30 days
    for (let i = 0; i < 200; i++) {
      const userId = users[randomInt(2, users.length - 1)]; // Skip admin and staff
      const locationId = randomElement(locationIds);
      const orderDate = randomDate(thirtyDaysAgo, now);
      const status = randomElement(statuses);

      const itemCount = randomInt(1, 3);
      let orderTotal = 0;

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, location_id, status, total_amount, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
        [userId, locationId, status, 0, orderDate],
      );
      const orderId = orderResult.rows[0].id;

      // Add order items
      for (let j = 0; j < itemCount; j++) {
        const basePrice = parseFloat(randomPrice(3, 6));
        const quantity = randomInt(1, 2);
        const itemPrice = basePrice + parseFloat(randomPrice(0, 2));
        const itemTotal = itemPrice * quantity;
        orderTotal += itemTotal;

        // USE ACTUAL MENU ITEM ID FROM DATABASE
        const menuItemId = randomElement(menuItemIdsForOrders);

        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, base_price, total_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            orderId,
            menuItemId,
            `Coffee Item ${j + 1}`,
            quantity,
            basePrice,
            itemPrice,
          ],
        );
      }

      // Update order total
      await client.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [
        orderTotal.toFixed(2),
        orderId,
      ]);

      // Create transaction
      const userBalanceResult = await client.query(
        `SELECT balance FROM users WHERE id = $1`,
        [userId],
      );
      const currentBalance = parseFloat(userBalanceResult.rows[0].balance);
      const newBalance = currentBalance - orderTotal;

      await client.query(
        `INSERT INTO transactions (user_id, order_id, type, amount, balance_before, balance_after, status, payment_method, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          orderId,
          "order_payment",
          orderTotal,
          currentBalance,
          newBalance,
          "completed",
          "balance",
          orderDate,
        ],
      );

      // Update user balance
      await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [
        newBalance,
        userId,
      ]);

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`   Created ${i + 1}/200 orders...`);
      }
    }

    console.log(`✅ Created 200 orders with transactions\n`);

    // ========================================
    // 12. Create Balance Top-ups
    // ========================================
    console.log("💰 Creating balance top-ups...");

    for (let i = 0; i < 50; i++) {
      const userId = users[randomInt(2, users.length - 1)];
      const topupDate = randomDate(thirtyDaysAgo, now);
      const amount = parseFloat(randomPrice(20, 200));

      const userBalanceResult = await client.query(
        `SELECT balance FROM users WHERE id = $1`,
        [userId],
      );
      const currentBalance = parseFloat(userBalanceResult.rows[0].balance);
      const newBalance = currentBalance + amount;

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          "balance_topup",
          amount,
          currentBalance,
          newBalance,
          "completed",
          "card",
          topupDate,
        ],
      );

      await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [
        newBalance,
        userId,
      ]);
    }

    console.log(`✅ Created 50 balance top-ups\n`);

    await client.query("COMMIT");

    console.log("✅ Database seeding completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`   - ${users.length} users`);
    console.log(`   - ${locationIds.length} locations`);
    console.log(`   - ${baseItemIds.length} base items`);
    console.log(`   - ${categoryIds.length} menu categories`);
    console.log(`   - 200 orders`);
    console.log(`   - 50 top-ups`);
    console.log("\n🔐 Login credentials:");
    console.log("   Admin: admin@coffee.com / Password123!");
    console.log("   Staff: staff@coffee.com / Password123!");
    console.log("   Customer: john.smith0@example.com / Password123!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error seeding database:", err);
  } finally {
    client.release();
    await pool.end();
  }
};

seedDatabase();
