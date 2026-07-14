const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const localPrisma = new PrismaClient();
const remotePrisma = new PrismaClient({
  datasources: { db: { url: process.env.SUPABASE_URL } },
});

async function run() {
  try {
    console.log("Connecting to Supabase...");
    // Перевірка зв'язку перед початком
    await remotePrisma.$connect();
    console.log("Connected!");

    // Синхронізуємо категорії
    console.log("Syncing categories...");
    const cats = await remotePrisma.variationCategory.findMany(); // Перевір назву моделі!
    if (cats.length > 0) {
      await localPrisma.variationCategory.deleteMany();
      await localPrisma.variationCategory.createMany({ data: cats });
      console.log(`Synced ${cats.length} categories.`);
    }

    // Синхронізуємо варіації
    console.log("Syncing variations...");
    const vars = await remotePrisma.variation.findMany(); // Перевір назву моделі!
    if (vars.length > 0) {
      await localPrisma.variation.deleteMany();
      await localPrisma.variation.createMany({ data: vars });
      console.log(`Synced ${vars.length} variations.`);
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await localPrisma.$disconnect();
    await remotePrisma.$disconnect();
  }
}

run();
