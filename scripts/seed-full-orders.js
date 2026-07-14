const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetSequences() {
  console.log("🔄 Синхронізація лічильників ID для PostgreSQL...");
  const tables = [
    "orders",
    "transactions",
    "order_items",
    "order_item_modifiers",
    "order_item_variations",
  ];

  for (const table of tables) {
    try {
      // Виставляємо серійний номер ID на максимальне значення + 1
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 0) + 1, false) FROM "${table}";`,
      );
    } catch (e) {
      console.warn(`⚠️ Пропущено скидання для ${table}: ${e.message}`);
    }
  }
}

async function seed() {
  try {
    // 1. Виправляємо проблему з Unique Constraint (ID)
    await resetSequences();

    // Завантажуємо базові дані
    const users = await prisma.users.findMany();
    const locations = await prisma.locations.findMany();
    const menuItems = await prisma.menu_items.findMany({
      include: {
        base_items: true,
        menu_item_modifiers: { include: { modifiers: true } },
        menu_item_variations: { include: { variations: true } },
      },
    });

    if (!users.length || !menuItems.length || !locations.length) {
      console.error(
        "❌ Помилка: Недостатньо даних у таблицях users, locations або menu_items.",
      );
      return;
    }

    // --- 2. ГЕНЕРАЦІЯ ПОПОВНЕНЬ БАЛАНСУ (topup) ---
    console.log("💳 Генеруємо поповнення балансу...");
    for (let i = 0; i < 15; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const amount = parseFloat((Math.random() * 50 + 50).toFixed(2)); // 50 - 100 одиниць
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 20));

      await prisma.$transaction(async (tx) => {
        const balanceBefore = parseFloat(user.balance || 0);

        await tx.transactions.create({
          data: {
            user_id: user.id,
            type: "balance_topup",
            amount: amount,
            balance_before: balanceBefore,
            balance_after: balanceBefore + amount,
            status: "completed",
            payment_method: "card",
            created_at: createdAt,
            notes: "Автоматичне поповнення",
          },
        });

        await tx.users.update({
          where: { id: user.id },
          data: { balance: { increment: amount } },
        });

        user.balance = (balanceBefore + amount).toString();
      });
    }

    // --- 3. ГЕНЕРАЦІЯ ЗАМОВЛЕНЬ (order_payment) ---
    console.log("☕ Генеруємо замовлення...");
    for (let i = 0; i < 50; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];

      // Випадковий метод оплати
      const paymentMethods = ["balance", "card", "cash"];
      const method =
        paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 14));

      let orderTotal = 0;
      const orderItemsData = [];
      const itemsInOrder = Math.floor(Math.random() * 2) + 1;

      for (let j = 0; j < itemsInOrder; j++) {
        const mItem = menuItems[Math.floor(Math.random() * menuItems.length)];
        const basePrice = parseFloat(
          mItem.custom_price || mItem.base_items?.base_price || 0,
        );

        let itemExtraCost = 0;
        const selectedModifiers = [];
        const selectedVariations = [];

        // Варіації (Розмір)
        if (mItem.menu_item_variations.length > 0) {
          const v =
            mItem.menu_item_variations[
              Math.floor(Math.random() * mItem.menu_item_variations.length)
            ];
          const priceAdj = parseFloat(v.price_adjustment || 0);
          itemExtraCost += priceAdj;
          selectedVariations.push({
            variation_id: v.variation_id,
            variation_name: v.variations?.name || "Standard",
            price_adjustment: priceAdj,
          });
        }

        // Модифікатори
        if (mItem.menu_item_modifiers.length > 0 && Math.random() > 0.4) {
          const mod =
            mItem.menu_item_modifiers[
              Math.floor(Math.random() * mItem.menu_item_modifiers.length)
            ];
          const modPrice = parseFloat(mod.price || 0);
          itemExtraCost += modPrice;
          selectedModifiers.push({
            modifier_id: mod.modifier_id,
            modifier_name: mod.modifiers?.name || "Extra",
            price: modPrice,
            quantity: 1,
          });
        }

        const finalItemPrice = basePrice + itemExtraCost;
        orderTotal += finalItemPrice;

        orderItemsData.push({
          menu_item_id: mItem.id,
          item_name:
            mItem.custom_name || mItem.base_items?.name || "Coffee Item",
          quantity: 1,
          base_price: basePrice,
          total_price: finalItemPrice,
          order_item_modifiers: { create: selectedModifiers },
          order_item_variations: { create: selectedVariations },
        });
      }

      // Виконуємо транзакцію замовлення
      await prisma.$transaction(async (tx) => {
        const balanceBefore = parseFloat(user.balance || 0);

        // Перевіряємо, чи достатньо коштів для оплати з балансу
        const actualMethod =
          method === "balance" && balanceBefore < orderTotal ? "card" : method;

        const order = await tx.orders.create({
          data: {
            user_id: user.id,
            location_id: location.id,
            status: "delivered",
            total_amount: orderTotal,
            created_at: createdAt,
            order_items: { create: orderItemsData },
          },
        });

        const isBalancePayment = actualMethod === "balance";
        const balanceAfter = isBalancePayment
          ? balanceBefore - orderTotal
          : balanceBefore;

        await tx.transactions.create({
          data: {
            user_id: user.id,
            order_id: order.id,
            type: "order_payment",
            amount: -orderTotal,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            status: "completed",
            payment_method: actualMethod,
            created_at: createdAt,
          },
        });

        if (isBalancePayment) {
          await tx.users.update({
            where: { id: user.id },
            data: { balance: { decrement: orderTotal } },
          });
          user.balance = balanceAfter.toString();
        }
      });
    }

    console.log("✅ Генерація завершена успішно!");
  } catch (e) {
    console.error("❌ Помилка:", e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
