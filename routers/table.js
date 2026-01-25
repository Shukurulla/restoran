const express = require("express");
const Table = require("../models/table");
const Staff = require("../models/staff");
const router = express.Router();
const cors = require("cors");

// Barcha stollarni olish (restaurantId bo'yicha filtrlash)
router.get("/tables", cors(), async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const filter = restaurantId ? { restaurantId } : {};
    const tables = await Table.find(filter)
      .populate("assignedWaiterId", "firstName lastName isWorking isOnline")
      .sort({ tableNumber: 1 });
    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yangi stol yaratish
router.post("/tables", cors(), async (req, res) => {
  try {
    const { restaurantId, title, tableNumber, surcharge, hasHourlyCharge, hourlyChargeAmount } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId majburiy" });
    }

    await Table.create({
      restaurantId,
      title,
      tableNumber: tableNumber || 0,
      surcharge: surcharge || 0,
      hasHourlyCharge: hasHourlyCharge || false,
      hourlyChargeAmount: hourlyChargeAmount || 0,
    });

    const tables = await Table.find({ restaurantId }).sort({ tableNumber: 1 });
    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stolni tahrirlash
router.post("/edit-tables/:id", cors(), async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    await Table.findByIdAndUpdate(req.params.id, req.body);
    const tables = await Table.find({ restaurantId: table.restaurantId }).sort({ tableNumber: 1 });
    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stolni o'chirish
router.post("/delete-tables/:id", cors(), async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    const restaurantId = table.restaurantId;
    await Table.findByIdAndRemove(req.params.id);
    const tables = await Table.find({ restaurantId }).sort({ tableNumber: 1 });
    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stolga waiter biriktirish
router.post("/tables/:id/assign-waiter", cors(), async (req, res) => {
  try {
    const { waiterId } = req.body;
    const table = await Table.findById(req.params.id);

    if (!table) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    // Agar waiterId null bo'lsa, waiter ni olib tashlash
    if (waiterId === null || waiterId === "") {
      table.assignedWaiterId = null;
      await table.save();
    } else {
      // Waiter mavjudligini tekshirish
      const waiter = await Staff.findById(waiterId);
      if (!waiter) {
        return res.status(404).json({ error: "Waiter topilmadi" });
      }

      // Faqat waiter role tekshirish
      if (waiter.role !== "waiter") {
        return res.status(400).json({ error: "Faqat waiter biriktirilishi mumkin" });
      }

      table.assignedWaiterId = waiterId;
      await table.save();
    }

    // Yangilangan stollar ro'yxatini qaytarish
    const tables = await Table.find({ restaurantId: table.restaurantId })
      .populate("assignedWaiterId", "firstName lastName isWorking isOnline")
      .sort({ tableNumber: 1 });

    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restoran waiterlarini olish (stol biriktirishda tanlash uchun)
router.get("/tables/waiters/:restaurantId", cors(), async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const waiters = await Staff.find({
      restaurantId,
      role: "waiter",
      status: "working",
    }).select("firstName lastName isWorking isOnline");

    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
