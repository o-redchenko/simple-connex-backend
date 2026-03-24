import bcrypt from "bcrypt";
import pool from "../src/config/database";

const createAdmin = async () => {
  const email = "admin@coffee.com";
  const password = "Admin123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role, balance)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role`,
      [email, hashedPassword, "Admin", "User", "admin", 0],
    );

    console.log("✅ Admin user created successfully:");
    console.log(result.rows[0]);
    console.log(`
Email: ${email}
Password: ${password}
    `);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin:", err);
    process.exit(1);
  }
};

createAdmin();
