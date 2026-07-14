require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../src/config/database");

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
// Parse CLI Arguments
// ========================================
const args = process.argv.slice(2);
const command = args[0];

const parseMonth = (monthStr) => {
  // Format: YYYY-MM or MM-YYYY
  const parts = monthStr.split("-");
  let year, month;

  if (parts[0].length === 4) {
    // YYYY-MM format
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
  } else {
    // MM-YYYY format
    month = parseInt(parts[0]) - 1;
    year = parseInt(parts[1]);
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return { startDate, endDate, year, month: month + 1 };
};

// ========================================
// Generate Customers
// ========================================
const generateCustomers = async (count, monthStr) => {
  const client = await pool.connect();

  try {
    const { startDate, endDate, year, month } = parseMonth(monthStr);

    console.log(
      `\n👥 Generating ${count} customers for ${year}-${String(month).padStart(2, "0")}...`,
    );
    console.log(
      `   Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`,
    );

    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash("Password123!", 10);
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
      "Alex",
      "Maria",
      "James",
      "Linda",
      "Robert",
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
      "Anderson",
      "Taylor",
      "Thomas",
      "Moore",
      "Jackson",
    ];

    const createdUsers = [];

    for (let i = 0; i < count; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const timestamp = Date.now();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${timestamp}.${i}@example.com`;
      const balance = parseFloat(randomPrice(50, 500));
      const createdAt = randomDate(startDate, endDate);

      const result = await client.query(
        `INSERT INTO users (email, password, first_name, last_name, role, balance, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, first_name, last_name, created_at`,
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

      createdUsers.push(result.rows[0]);

      if ((i + 1) % 10 === 0) {
        console.log(`   Created ${i + 1}/${count} customers...`);
      }
    }

    await client.query("COMMIT");

    console.log(`\n✅ Successfully created ${createdUsers.length} customers`);
    console.log(`\nSample users:`);
    createdUsers.slice(0, 3).forEach((u) => {
      console.log(`   - ${u.first_name} ${u.last_name} (${u.email})`);
      console.log(
        `     Created: ${new Date(u.created_at).toLocaleDateString()}`,
      );
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error generating customers:", err);
    throw err;
  } finally {
    client.release();
  }
};

// ========================================
// Generate Orders
// ========================================
const generateOrders = async (count, monthStr) => {
  const client = await pool.connect();

  try {
    const { startDate, endDate, year, month } = parseMonth(monthStr);

    console.log(
      `\n🛒 Generating ${count} orders for ${year}-${String(month).padStart(2, "0")}...`,
    );
    console.log(
      `   Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`,
    );

    await client.query("BEGIN");

    // Get available users (customers only)
    const usersResult = await client.query(
      `SELECT id FROM users WHERE role = 'customer' ORDER BY RANDOM()`,
    );

    if (usersResult.rows.length === 0) {
      throw new Error("No customers found. Create customers first.");
    }

    const userIds = usersResult.rows.map((r) => r.id);

    // Get available locations
    const locationsResult = await client.query(
      `SELECT id FROM locations WHERE is_active = true`,
    );

    if (locationsResult.rows.length === 0) {
      throw new Error("No active locations found.");
    }

    const locationIds = locationsResult.rows.map((r) => r.id);

    // Get available menu items
    const menuItemsResult = await client.query(
      `SELECT id FROM menu_items WHERE is_available = true`,
    );

    if (menuItemsResult.rows.length === 0) {
      throw new Error("No available menu items found.");
    }

    const menuItemIds = menuItemsResult.rows.map((r) => r.id);

    console.log(`   Found ${menuItemIds.length} available menu items`);

    const statuses = [
      "pending",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ];
    const statusWeights = [0.05, 0.1, 0.15, 0.65, 0.05]; // Most orders delivered

    const getWeightedStatus = () => {
      const rand = Math.random();
      let cumulative = 0;

      for (let i = 0; i < statuses.length; i++) {
        cumulative += statusWeights[i];
        if (rand < cumulative) return statuses[i];
      }

      return statuses[statuses.length - 1];
    };

    const createdOrders = [];

    for (let i = 0; i < count; i++) {
      const userId = randomElement(userIds);
      const locationId = randomElement(locationIds);
      const orderDate = randomDate(startDate, endDate);
      const status = getWeightedStatus();

      const itemCount = randomInt(1, 4);
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
        const menuItemId = randomElement(menuItemIds);

        // Get menu item details for snapshot
        const itemDetails = await client.query(
          `SELECT 
            COALESCE(mi.custom_name, bi.name) as name,
            COALESCE(mi.custom_description, bi.description) as description,
          COALESCE(mi.custom_price, bi.base_price) as base_price
          FROM menu_items mi
          JOIN base_items bi ON mi.base_item_id = bi.id
          WHERE mi.id = $1`,
          [menuItemId],
        );

        const itemData = itemDetails.rows[0];
        const basePrice = parseFloat(randomPrice(3, 8));
        const quantity = randomInt(1, 3);
        const itemPrice = basePrice + parseFloat(randomPrice(0, 3)); // Add variation/modifier costs
        const itemTotal = itemPrice * quantity;
        orderTotal += itemTotal;

        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, base_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            orderId,
            menuItemId,
            itemData.name,
            itemData.description,
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
      const newBalance = Math.max(0, currentBalance - orderTotal);

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

      createdOrders.push({ id: orderId, total: orderTotal, date: orderDate });

      if ((i + 1) % 20 === 0) {
        console.log(`   Created ${i + 1}/${count} orders...`);
      }
    }

    await client.query("COMMIT");

    console.log(`\n✅ Successfully created ${createdOrders.length} orders`);

    const totalRevenue = createdOrders.reduce(
      (sum, o) => sum + parseFloat(o.total),
      0,
    );
    console.log(`\nStatistics:`);
    console.log(`   - Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(
      `   - Average Order: $${(totalRevenue / createdOrders.length).toFixed(2)}`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error generating orders:", err);
    throw err;
  } finally {
    client.release();
  }
};

// ========================================
// Generate Top-ups
// ========================================
const generateTopups = async (count, monthStr) => {
  const client = await pool.connect();

  try {
    const { startDate, endDate, year, month } = parseMonth(monthStr);

    console.log(
      `\n💰 Generating ${count} top-ups for ${year}-${String(month).padStart(2, "0")}...`,
    );
    console.log(
      `   Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`,
    );

    await client.query("BEGIN");

    const usersResult = await client.query(
      `SELECT id FROM users WHERE role = 'customer' ORDER BY RANDOM()`,
    );

    if (usersResult.rows.length === 0) {
      throw new Error("No customers found.");
    }

    const userIds = usersResult.rows.map((r) => r.id);

    for (let i = 0; i < count; i++) {
      const userId = randomElement(userIds);
      const topupDate = randomDate(startDate, endDate);
      const amount = parseFloat(randomPrice(20, 300));

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

      if ((i + 1) % 10 === 0) {
        console.log(`   Created ${i + 1}/${count} top-ups...`);
      }
    }

    await client.query("COMMIT");

    console.log(`\n✅ Successfully created ${count} top-ups`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error generating top-ups:", err);
    throw err;
  } finally {
    client.release();
  }
};

// ========================================
// Main CLI Handler
// ========================================
const main = async () => {
  try {
    if (!command) {
      console.log(`
📊 Data Generator Tool

Usage:
  npm run generate customers <count> <month>
  npm run generate orders <count> <month>
  npm run generate topups <count> <month>

Examples:
  npm run generate customers 50 2024-12
  npm run generate orders 200 12-2024
  npm run generate topups 30 2025-01

Month format: YYYY-MM or MM-YYYY
      `);
      process.exit(0);
    }

    const count = parseInt(args[1]);
    const monthStr = args[2];

    if (!count || count <= 0) {
      console.error("❌ Invalid count. Must be a positive number.");
      process.exit(1);
    }

    if (!monthStr || !monthStr.match(/^\d{1,2}-\d{4}$|^\d{4}-\d{1,2}$/)) {
      console.error("❌ Invalid month format. Use YYYY-MM or MM-YYYY");
      process.exit(1);
    }

    switch (command) {
      case "customers":
        await generateCustomers(count, monthStr);
        break;

      case "orders":
        await generateOrders(count, monthStr);
        break;

      case "topups":
        await generateTopups(count, monthStr);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("Valid commands: customers, orders, topups");
        process.exit(1);
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
};

main();
