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
    let clickRevenue = 0;
    let unpaidAmount = 0;
    let paidOrders = 0;

    orders.forEach(order => {
      // Agar to'langan bo'lsa, totalPrice allaqachon tayyor
      // Agar to'lanmagan bo'lsa, 10% qo'shib hisoblash (saboy uchun 10% yo'q)
      let amount;
      const isSaboy = order.orderType === "saboy";

      if (order.isPaid) {
        amount = order.totalPrice || 0;
        paidOrders += 1;
      } else {
        // To'lanmagan orderlar uchun
        const itemsTotal = (order.selectFoods || order.allOrders || []).reduce((sum, item) => {
          return sum + ((item.price || 0) * (item.quantity || item.count || 1));
        }, 0);
        // Saboy uchun xizmat haqi yo'q
        const serviceFee = isSaboy ? 0 : Math.round(itemsTotal * 0.1);
        amount = itemsTotal + serviceFee;
      }

      totalRevenue += amount;

      if (order.isPaid) {
        // Bo'lingan to'lov (split payment) bo'lsa
        if (order.paymentSplit) {
          cashRevenue += order.paymentSplit.cash || 0;
          cardRevenue += order.paymentSplit.card || 0;
          clickRevenue += order.paymentSplit.click || 0;
        } else {
          // Oddiy to'lov
          if (order.paymentType === 'cash') {
            cashRevenue += amount;
          } else if (order.paymentType === 'card') {
            cardRevenue += amount;
          } else if (order.paymentType === 'click') {
            clickRevenue += amount;
          }
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
      clickRevenue,
      unpaidAmount,
      paidOrders
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
    const { paymentType, paymentSplit, comment } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Buyurtma topilmadi" });
    }

    // Taomlar summasini hisoblash
    const itemsTotal = (order.selectFoods || order.allOrders || []).reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || item.count || 1));
    }, 0);

    // 10% xizmat haqi (saboy uchun yo'q)
    const isSaboy = order.orderType === "saboy";
    const serviceFee = isSaboy ? 0 : Math.round(itemsTotal * 0.1);

    // Soatlik haq hisoblash
    let hourlyChargeTotal = 0;
    if (order.occupancyStartedAt && order.tableId) {
      const table = await Table.findById(order.tableId);
      if (table && table.hasHourlyCharge && table.hourlyChargeAmount > 0) {
        const now = new Date();
        const startTime = new Date(order.occupancyStartedAt);
        const hoursElapsed = (now - startTime) / (1000 * 60 * 60); // millisekunddan soatga
        // Har bir boshlangan soat uchun haq olish (ceiling)
        const billableHours = Math.ceil(hoursElapsed);
        hourlyChargeTotal = billableHours * table.hourlyChargeAmount;
        console.log(`Soatlik haq: ${billableHours} soat x ${table.hourlyChargeAmount} = ${hourlyChargeTotal} so'm`);
      }
    }

    const grandTotal = itemsTotal + serviceFee + hourlyChargeTotal;

    // Order ni yangilash
    order.isPaid = true;
    order.paymentType = paymentType;
    order.paidAt = new Date();
    order.status = "paid";
    order.totalPrice = grandTotal; // 10% xizmat haqi + soatlik haq bilan
    order.ofitsianService = serviceFee;
    order.hourlyChargeTotal = hourlyChargeTotal;

    // Bo'lingan to'lov (split payment)
    if (paymentSplit) {
      order.paymentSplit = {
        cash: paymentSplit.cash || 0,
        card: paymentSplit.card || 0,
        click: paymentSplit.click || 0,
      };
    }

    // To'lov izohi
    if (comment) {
      order.comment = comment;
    }

    await order.save();

    // KitchenOrder ni ham yangilash - barcha itemlarni "served" qilish
    await KitchenOrder.updateMany(
      { orderId: order._id },
      {
        isPaid: true,
        paidAt: new Date(),
        paymentMethod: paymentType,
        status: "served",
        allItemsReady: true,
        hourlyChargeTotal: hourlyChargeTotal
      }
    );

    // Stolni bo'shatish
    if (order.tableId) {
      await Table.findByIdAndUpdate(order.tableId, {
        status: "free"
      });
    }

    // Socket.io orqali cashier ga xabar berish
    const io = req.app.get("io");
    if (io) {
      io.to(`cashier_${order.restaurantId}`).emit("order_paid_success", {
        orderId: order._id,
        tableName: order.tableName,
        paymentType,
        paymentSplit,
        grandTotal,
        hourlyChargeTotal,
        itemsTotal,
        serviceFee,
      });

      // Order completed event (barcha itemlar yetkazildi)
      io.to(`cashier_${order.restaurantId}`).emit("order_completed", {
        orderId: order._id,
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

// Order ni to'liq o'chirish (KitchenOrder bilan birga)
router.post("/delete-order/:id", cors(), async (req, res) => {
  try {
    const orderId = req.params.id;

    // Order ni topish
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Buyurtma topilmadi" });
    }

    const restaurantId = order.restaurantId;
    const tableId = order.tableId;

    // KitchenOrder larni o'chirish
    await KitchenOrder.deleteMany({ orderId: orderId });

    // Order ni o'chirish
    await Order.findByIdAndRemove(orderId);

    // Agar stol bo'lsa va boshqa active order yo'q bo'lsa - stolni bo'shatish
    if (tableId) {
      const otherActiveOrders = await Order.countDocuments({
        tableId: tableId,
        status: { $nin: ["paid", "cancelled"] }
      });

      if (otherActiveOrders === 0) {
        await Table.findByIdAndUpdate(tableId, { status: "free" });
      }
    }

    // Socket orqali xabar berish
    const io = req.app.get("io");
    if (io && restaurantId) {
      io.to(`restaurant_${restaurantId}`).emit("order_deleted", { orderId });
      io.to(`cashier_${restaurantId}`).emit("order_deleted", { orderId });
      io.to(`kitchen_${restaurantId}`).emit("order_deleted", { orderId });
    }

    console.log(`Order ${orderId} to'liq o'chirildi`);

    const orders = await Order.find();
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ITEM O'CHIRISH ============

// Order dan bitta itemni o'chirish
router.delete("/orders/:orderId/items/:itemId", cors(), async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Buyurtma topilmadi" });
    }

    // selectFoods dan o'chirish
    if (order.selectFoods && order.selectFoods.length > 0) {
      order.selectFoods = order.selectFoods.filter(item =>
        item._id?.toString() !== itemId && item.foodId?.toString() !== itemId
      );
    }

    // allOrders dan o'chirish
    if (order.allOrders && order.allOrders.length > 0) {
      order.allOrders = order.allOrders.filter(item =>
        item._id?.toString() !== itemId && item.foodId?.toString() !== itemId
      );
    }

    // Agar barcha itemlar o'chirilgan bo'lsa - orderni ham o'chirish
    const remainingItems = order.selectFoods?.length || order.allOrders?.length || 0;
    if (remainingItems === 0) {
      // KitchenOrder larni o'chirish
      await KitchenOrder.deleteMany({ orderId: orderId });
      await Order.findByIdAndRemove(orderId);

      // Stolni bo'shatish
      if (order.tableId) {
        const otherActiveOrders = await Order.countDocuments({
          tableId: order.tableId,
          status: { $nin: ["paid", "cancelled"] }
        });

        if (otherActiveOrders === 0) {
          await Table.findByIdAndUpdate(order.tableId, { status: "free" });
        }
      }

      // Socket orqali xabar berish
      const io = req.app.get("io");
      if (io && order.restaurantId) {
        io.to(`restaurant_${order.restaurantId}`).emit("order_deleted", { orderId });
        io.to(`cashier_${order.restaurantId}`).emit("order_deleted", { orderId });
        io.to(`kitchen_${order.restaurantId}`).emit("order_deleted", { orderId });
      }

      return res.json({
        success: true,
        orderDeleted: true,
        message: "Barcha itemlar o'chirilgani uchun buyurtma ham o'chirildi"
      });
    }

    // Yangi summani hisoblash
    const items = order.selectFoods || order.allOrders || [];
    const newTotal = items.reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || item.count || 1));
    }, 0);

    order.totalPrice = newTotal;
    await order.save();

    // KitchenOrder ni ham yangilash
    await KitchenOrder.updateMany(
      { orderId: orderId },
      {
        items: items,
        $pull: {
          items: {
            $or: [
              { _id: itemId },
              { foodId: itemId }
            ]
          }
        }
      }
    );

    // Socket orqali xabar berish
    const io = req.app.get("io");
    if (io && order.restaurantId) {
      io.to(`restaurant_${order.restaurantId}`).emit("order_item_deleted", {
        orderId,
        itemId,
        newTotal
      });
      io.to(`cashier_${order.restaurantId}`).emit("order_item_deleted", {
        orderId,
        itemId,
        newTotal
      });
      io.to(`kitchen_${order.restaurantId}`).emit("order_item_deleted", {
        orderId,
        itemId
      });
    }

    console.log(`Order ${orderId} dan item ${itemId} o'chirildi`);

    res.json({
      success: true,
      order,
      remainingItems: items.length,
      newTotal
    });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SABOY (OLIB KETISH) ============

// Saboy order yaratish - to'g'ridan-to'g'ri to'langan, oshxonaga yuborilmaydi
router.post("/orders/saboy", cors(), async (req, res) => {
  try {
    const { restaurantId, items, paymentType, paymentSplit, comment } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID topilmadi" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Mahsulotlar tanlanmagan" });
    }

    // Bugungi saboy raqamini olish
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saboyCount = await Order.countDocuments({
      restaurantId,
      orderType: "saboy",
      createdAt: { $gte: today },
    });
    const saboyNumber = saboyCount + 1;

    // Taomlar summasini hisoblash (10% xizmat haqi YO'Q)
    const itemsTotal = items.reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || 1));
    }, 0);

    // Saboy uchun xizmat haqi yo'q
    const grandTotal = itemsTotal;

    // Order yaratish - to'g'ridan-to'g'ri to'langan holda
    const order = await Order.create({
      restaurantId,
      orderType: "saboy",
      saboyNumber,
      tableId: null,
      tableName: `Saboy #${saboyNumber}`,
      tableNumber: 0,
      selectFoods: items,
      allOrders: items,
      totalPrice: grandTotal,
      ofitsianService: 0, // Xizmat haqi yo'q
      status: "paid",
      isPaid: true,
      paymentType: paymentType || "cash",
      paymentSplit: paymentSplit || null,
      comment: comment || null,
      paidAt: new Date(),
      waiterApproved: true,
      approvedAt: new Date(),
    });

    // Socket orqali cashierga yangilash xabari
    const io = req.app.get("io");
    if (io) {
      io.to(`cashier_${restaurantId}`).emit("saboy_order_created", {
        order,
        saboyNumber,
        grandTotal,
      });
    }

    console.log(`Saboy order #${saboyNumber} yaratildi: ${grandTotal} so'm`);

    res.json({
      success: true,
      order,
      saboyNumber,
      grandTotal,
    });
  } catch (error) {
    console.error("Saboy order error:", error);
    res.status(500).json({ error: error.message });
  }
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
