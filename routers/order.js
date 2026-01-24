const express = require("express");
const Order = require("../models/order");
const KitchenOrder = require("../models/kitchen-order");
const Table = require("../models/table");
const Staff = require("../models/staff");
const router = express.Router();
const cors = require("cors");

router.get("/orders", cors(), async (req, res) => {
  const { restaurantId, status } = req.query;
  let filter = {};
  if (restaurantId) filter.restaurantId = restaurantId;
  if (status) filter.status = status;
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json({ data: orders });
});

// ============ CASHIER ENDPOINTS ============

// Bugungi buyurtmalar
router.get("/orders/today", cors(), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      createdAt: { $gte: today }
    }).sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kunlik hisobot (summary)
router.get("/orders/daily-summary", cors(), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      createdAt: { $gte: today }
    });

    let totalOrders = orders.length;
    let totalRevenue = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let unpaidAmount = 0;

    orders.forEach(order => {
      const amount = order.totalPrice || 0;
      totalRevenue += amount;

      if (order.isPaid) {
        if (order.paymentType === 'cash') {
          cashRevenue += amount;
        } else if (order.paymentType === 'card') {
          cardRevenue += amount;
        }
      } else {
        unpaidAmount += amount;
      }
    });

    res.json({
      totalOrders,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      unpaidAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiantlar statistikasi
router.get("/orders/waiter-stats", cors(), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      createdAt: { $gte: today }
    });

    const waiterMap = new Map();

    orders.forEach(order => {
      const waiterName = order.waiterName || 'Noma\'lum';
      const existing = waiterMap.get(waiterName) || { name: waiterName, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += order.totalPrice || 0;
      waiterMap.set(waiterName, existing);
    });

    const stats = Array.from(waiterMap.values());
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// To'lov qilish
router.post("/orders/:orderId/pay", cors(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentType } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Buyurtma topilmadi" });
    }

    // Order ni yangilash
    order.isPaid = true;
    order.paymentType = paymentType;
    order.paidAt = new Date();
    order.status = "paid";
    await order.save();

    // KitchenOrder ni ham yangilash - barcha itemlarni "served" qilish
    await KitchenOrder.updateMany(
      { orderId: order._id },
      {
        isPaid: true,
        paidAt: new Date(),
        paymentMethod: paymentType,
        status: "served",
        allItemsReady: true
      }
    );

    // Stolni bo'shatish
    if (order.tableId) {
      await Table.findByIdAndUpdate(order.tableId, {
        status: "free"
      });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/edit-order/:id", cors(), async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, req.body);
  const orders = await Order.find();
  res.json({ data: orders });
});

router.post("/delete-order/:id", cors(), async (req, res) => {
  await Order.findByIdAndRemove(req.params.id);
  const orders = await Order.find();
  res.json({ data: orders });
});

// ============ STOL KO'CHIRISH ============

// Buyurtmani boshqa stolga ko'chirish
router.patch("/orders/:orderId/transfer-table", cors(), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newTableId } = req.body;

    // Yangi stolni olish
    const newTable = await Table.findById(newTableId).populate("assignedWaiter");
    if (!newTable) {
      return res.status(404).json({ error: "Yangi stol topilmadi" });
    }

    // Order ni yangilash
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Buyurtma topilmadi" });
    }

    const oldTableId = order.tableId;

    // Order'ni yangi stolga ko'chirish
    order.tableId = newTableId;
    order.tableName = newTable.tableName;
    order.tableNumber = newTable.tableNumber;

    // Agar yangi stolda waiter biriktirilgan bo'lsa - waiter'ni ham o'zgartirish
    if (newTable.assignedWaiter) {
      order.waiterId = newTable.assignedWaiter._id;
      order.waiterName = `${newTable.assignedWaiter.firstName} ${newTable.assignedWaiter.lastName}`;
    }

    await order.save();

    // KitchenOrder ni ham yangilash
    await KitchenOrder.updateMany(
      { orderId: orderId },
      {
        tableId: newTableId,
        tableName: newTable.tableName,
        tableNumber: newTable.tableNumber,
        waiterId: newTable.assignedWaiter?._id || null,
        waiterName: newTable.assignedWaiter
          ? `${newTable.assignedWaiter.firstName} ${newTable.assignedWaiter.lastName}`
          : null,
      }
    );

    res.json({
      success: true,
      message: `Buyurtma ${newTable.tableName} ga ko'chirildi`,
      order,
      newTable: {
        id: newTable._id,
        tableName: newTable.tableName,
        assignedWaiter: newTable.assignedWaiter
          ? {
              id: newTable.assignedWaiter._id,
              name: `${newTable.assignedWaiter.firstName} ${newTable.assignedWaiter.lastName}`,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Transfer table error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
