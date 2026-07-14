require("dotenv").config();
const bcrypt = require("bcrypt");
const dbModule = require("../dist/config/database");
const pool = dbModule.default || dbModule;

const createOrUpdateAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || "admin@coffee.com";
  const password = process.env.ADMIN_PASSWORD || "Admin123!";

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role, balance)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         role = EXCLUDED.role
       RETURNING id, email, role, (xmax = 0) AS is_inserted`,
      [email, hashedPassword, "Admin", "User", "admin", 0],
    );

    const user = result.rows[0];
    const actionText = user.is_inserted ? "created" : "updated";

    console.log(`✅ Admin user ${actionText} successfully:`);
    console.log({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    console.log(`\nEmail: ${email}\nPassword: ${password}\n`);
  } catch (err) {
    console.error(
      "❌ Error creating/updating admin:",
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 1;
  } finally {
    // Безумовне та безпечне закриття пулу з'єднань
    await pool.end();
  }
};

createOrUpdateAdmin();
