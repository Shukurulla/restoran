const express = require("express");
const KitchenOrder = require("../models/kitchen-order");
const Waiter = require("../models/waiter");
const router = express.Router();
const cors = require("cors");

// Barcha kitchen orderlarni olish (oshpaz uchun)
// cookId parameter bilan - faqat shu cook'ga biriktirilgan categorylarni ko'rsatadi
router.get("/kitchen-orders", cors(), async (req, res) => {
  try {
    const { restaurantId, cookId } = req.query;
    const Staff = require("../models/staff");

    const filter = {
      status: { $in: ["pending", "preparing"] },
      // MUHIM: Faqat waiter tomonidan tasdiqlangan orderlarni ko'rsatish
      // yoki eski orderlar (waiterApproved field yo'q)
      $or: [
        { waiterApproved: true },
        { waiterApproved: { $exists: false } }
      ]
    };

    // RestaurantId bo'yicha filter
    if (restaurantId) {
      filter.restaurantId = restaurantId;
    }

    let orders = await KitchenOrder.find(filter)
      .sort({ createdAt: 1 })
      .populate("waiterId");

    // Agar cookId berilgan bo'lsa, faqat shu cook'ga biriktirilgan categorylarni filter qilish
    if (cookId) {
      const cook = await Staff.findById(cookId);
      if (cook && cook.assignedCategories && cook.assignedCategories.length > 0) {
        // Har bir orderdagi itemlarni filter qilish - faqat shu cook'ga tegishli categorylar
        orders = orders.map(order => {
          const orderObj = order.toObject();
          // Faqat shu cook'ga biriktirilgan category'dagi itemlarni ko'rsatish
          orderObj.items = orderObj.items.filter(item => {
            // Item'ning category'sini tekshirish
            return cook.assignedCategories.includes(item.category);
          });
          return orderObj;
        }).filter(order => order.items.length > 0); // Bo'sh orderlarni olib tashlash
      }
    }

    res.json({ data: orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bugungi barcha kitchen orderlar
router.get("/kitchen-orders/today", cors(), async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {
      createdAt: { $gte: today },
    };

    // RestaurantId bo'yicha filter
    if (restaurantId) {
      filter.restaurantId = restaurantId;
    }

    const orders = await KitchenOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate("waiterId");
    res.json({ data: orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyant uchun orderlar (restoran bo'yicha)
router.get("/kitchen-orders/waiter/:waiterId", cors(), async (req, res) => {
  try {
    const { waiterId } = req.params;
    const { date, showPaid, restaurantId, pendingApproval } = req.query; // YYYY-MM-DD format, showPaid=true for history, pendingApproval=true for pending orders

    // Waiter'ning restaurantId sini olish
    const Staff = require("../models/staff");
    const waiter = await Staff.findById(waiterId);

    if (!waiter) {
      return res.status(404).json({ error: "Waiter not found" });
    }

    // RestaurantId - query'dan yoki waiter'dan
    const effectiveRestaurantId = restaurantId || waiter.restaurantId;

    // Waiter bo'yicha filter - har bir waiter faqat o'z orderlarini ko'radi
    let filter = {
      restaurantId: effectiveRestaurantId,
      waiterId: waiterId
    };

    // Agar pendingApproval=true bo'lsa, faqat tasdiqlash kutilayotgan buyurtmalarni ko'rsatish
    if (pendingApproval === 'true') {
      filter.waiterApproved = { $ne: true };
      filter.waiterRejected = { $ne: true };
      // Bugungi buyurtmalar
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };

      console.log(`Getting pending approval orders for waiter ${waiterId}, filter:`, filter);
      const orders = await KitchenOrder.find(filter).sort({ createdAt: -1 });
      console.log(`Found ${orders.length} pending approval orders`);
      return res.json({ data: orders });
    }

    // Agar showPaid=true bo'lmasa, faqat to'lanmagan (faol) buyurtmalarni ko'rsatish
    if (showPaid !== 'true') {
      filter.isPaid = false;
    }

    // Sana bo'yicha filter
    if (date) {
      // Tanlangan sana
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (showPaid !== 'true') {
      // Bugun - faqat faol buyurtmalar uchun
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    // Default: faqat tasdiqlangan orderlarni ko'rsatish (waiterApproved=true yoki eski orderlar)
    // Eski orderlar uchun waiterApproved field yo'q bo'lishi mumkin
    filter.$or = [
      { waiterApproved: true },
      { waiterApproved: { $exists: false } }
    ];

    console.log(`Getting orders for waiter ${waiterId}, restaurantId: ${effectiveRestaurantId}, filter:`, filter);

    const orders = await KitchenOrder.find(filter).sort({ createdAt: -1 });

    console.log(`Found ${orders.length} orders for restaurant ${effectiveRestaurantId}`);

    res.json({ data: orders });
  } catch (error) {
    console.error("Get waiter orders error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bitta itemni tayyor deb belgilash
router.patch(
  "/kitchen-orders/:orderId/items/:itemIndex/ready",
  cors(),
  async (req, res) => {
    try {
      const { orderId, itemIndex } = req.params;
      const order = await KitchenOrder.findById(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order topilmadi" });
      }

      const index = parseInt(itemIndex);
      if (index < 0 || index >= order.items.length) {
        return res.status(400).json({ error: "Item topilmadi" });
      }

      order.items[index].isReady = !order.items[index].isReady;
      order.items[index].readyAt = order.items[index].isReady
        ? new Date()
        : null;

      // Barcha itemlar tayyor bo'lsa
      const allReady = order.items.every((item) => item.isReady);
      order.allItemsReady = allReady;

      if (allReady) {
        order.status = "ready";
      } else if (order.items.some((item) => item.isReady)) {
        order.status = "preparing";
      } else {
        order.status = "pending";
      }

      await order.save();

      const orders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      res.json({ data: orders, updatedOrder: order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Ofitsiyantga xabar yuborish
router.patch(
  "/kitchen-orders/:orderId/notify-waiter",
  cors(),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await KitchenOrder.findById(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order topilmadi" });
      }

      order.notifiedWaiter = true;
      order.notifiedAt = new Date();
      await order.save();

      res.json({ data: order });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Ofitsiyant tomonidan xizmat ko'rsatildi
router.patch("/kitchen-orders/:orderId/served", cors(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await KitchenOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order topilmadi" });
    }

    order.status = "served";
    order.servedAt = new Date();
    await order.save();

    res.json({ data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyant login
router.post("/waiter/login", cors(), async (req, res) => {
  try {
    const { phone, password } = req.body;

    const waiter = await Waiter.findOne({ phone });

    if (!waiter) {
      return res.status(404).json({ error: "Ofitsiyant topilmadi" });
    }

    if (waiter.password !== password) {
      return res.status(401).json({ error: "Parol noto'g'ri" });
    }

    if (!waiter.isActive) {
      return res.status(403).json({ error: "Hisobingiz faol emas" });
    }

    res.json({
      data: {
        _id: waiter._id,
        firstName: waiter.firstName,
        lastName: waiter.lastName,
        phone: waiter.phone,
        isActive: waiter.isActive,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantning bugungi statistikasi (restoran bo'yicha)
router.get("/waiter/:waiterId/stats", cors(), async (req, res) => {
  try {
    const { waiterId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Waiter'ning restaurantId sini olish
    const Staff = require("../models/staff");
    const waiter = await Staff.findById(waiterId);

    if (!waiter) {
      return res.status(404).json({ error: "Waiter not found" });
    }

    // Shu waiter'ning o'z to'lanmagan buyurtmalarini olish
    const orders = await KitchenOrder.find({
      restaurantId: waiter.restaurantId,
      waiterId: waiterId,
      createdAt: { $gte: today },
      isPaid: false, // Faqat to'lanmagan (faol) buyurtmalar
    });

    console.log(`Stats for waiter ${waiterId}, restaurant ${waiter.restaurantId}: ${orders.length} active orders found`);

    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      preparingOrders: orders.filter((o) => o.status === "preparing").length,
      readyOrders: orders.filter(
        (o) => o.status === "ready" && o.notifiedWaiter
      ).length,
      servedOrders: orders.filter((o) => o.status === "served").length,
    };

    res.json({ data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantning faol stollarini olish
router.get("/waiter/:waiterId/active-tables", cors(), async (req, res) => {
  try {
    const { waiterId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Waiter'ning restaurantId sini olish
    const Staff = require("../models/staff");
    const waiter = await Staff.findById(waiterId);

    if (!waiter) {
      return res.status(404).json({ error: "Waiter not found" });
    }

    // Shu waiter'ning o'z faol buyurtmalarini olish
    const orders = await KitchenOrder.find({
      restaurantId: waiter.restaurantId,
      waiterId: waiterId,
      createdAt: { $gte: today },
      status: { $in: ["pending", "preparing", "ready"] },
      isPaid: false, // Faqat to'lanmagan buyurtmalar
    }).sort({ createdAt: -1 });

    console.log(`Active tables for waiter ${waiterId}, restaurant ${waiter.restaurantId}: ${orders.length} orders found`);

    // Stollar bo'yicha guruhlash
    const tablesMap = {};
    orders.forEach((order) => {
      const tableKey = order.tableId?.toString() || order._id.toString();
      if (!tablesMap[tableKey]) {
        tablesMap[tableKey] = {
          _id: order._id,
          id: order._id.toString(),
          tableId: order.tableId,
          tableName: order.tableName,
          tableNumber: order.tableNumber,
          status: order.status,
          items: order.items,
          waiterId: order.waiterId,
          waiterName: order.waiterName,
          createdAt: order.createdAt,
          // Qo'shimcha ma'lumot - bu order shu waiter'ga tegishlimi
          isAssignedToMe: order.waiterId?.toString() === waiterId,
        };
      }
    });

    console.log(`Active tables for waiter ${waiterId}: ${Object.keys(tablesMap).length} tables found`);

    res.json({ data: Object.values(tablesMap) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantning notificationlarini olish
router.get("/waiter/:waiterId/notifications", cors(), async (req, res) => {
  try {
    const { waiterId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifications = await KitchenOrder.find({
      waiterId: waiterId,
      notifiedWaiter: true,
      status: "ready",
      createdAt: { $gte: today },
    }).sort({ notifiedAt: -1 });

    res.json({ data: notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
