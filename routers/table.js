const express = require("express");
const Table = require("../models/table");
const router = express.Router();
const cors = require("cors");

// Barcha stollarni olish (restaurantId bo'yicha filtrlash)
router.get("/tables", cors(), async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const filter = restaurantId ? { restaurantId } : {};
    const tables = await Table.find(filter).sort({ tableNumber: 1 });
    res.json({ data: tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yangi stol yaratish
router.post("/tables", cors(), async (req, res) => {
  try {
    const { restaurantId, title, tableNumber, surcharge } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId majburiy" });
    }

    await Table.create({
      restaurantId,
      title,
      tableNumber: tableNumber || 0,
      surcharge: surcharge || 0,
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

module.exports = router;
