/**
 * Barcha orderlarni o'chirish scripti
 * Ishlatish: node scripts/clear-orders.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Models
const Order = require("../models/order");
const KitchenOrder = require("../models/kitchen-order");
const SaveOrder = require("../models/checkOrder");

async function clearAllOrders() {
  try {
    console.log("MongoDB ga ulanmoqda...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB ga ulandi!\n");

    // Orders ni o'chirish
    const ordersCount = await Order.countDocuments();
    await Order.deleteMany({});
    console.log(`✓ Orders: ${ordersCount} ta o'chirildi`);

    // KitchenOrders ni o'chirish
    const kitchenOrdersCount = await KitchenOrder.countDocuments();
    await KitchenOrder.deleteMany({});
    console.log(`✓ KitchenOrders: ${kitchenOrdersCount} ta o'chirildi`);

    // SaveOrders (checkOrder) ni o'chirish
    const saveOrdersCount = await SaveOrder.countDocuments();
    await SaveOrder.deleteMany({});
    console.log(`✓ SaveOrders: ${saveOrdersCount} ta o'chirildi`);

    console.log("\n✅ Barcha orderlar muvaffaqiyatli o'chirildi!");
  } catch (error) {
    console.error("❌ Xatolik:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB dan uzildi.");
    process.exit(0);
  }
}

clearAllOrders();
