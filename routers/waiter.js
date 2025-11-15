const express = require("express");
const Waiter = require("../models/waiter");
const router = express.Router();
const cors = require("cors");

// Barcha ofitsiyantlarni olish
router.get("/waiters", cors(), async (req, res) => {
  try {
    const waiters = await Waiter.find().sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yangi ofitsiyant qo'shish
router.post("/waiters", cors(), async (req, res) => {
  try {
    const { firstName, lastName, phone, password } = req.body;

    // Telefon raqami mavjudligini tekshirish
    const existingWaiter = await Waiter.findOne({ phone });
    if (existingWaiter) {
      return res.status(400).json({ error: "Bu telefon raqam allaqachon mavjud" });
    }

    const waiter = await Waiter.create({
      firstName,
      lastName,
      phone,
      password, // Hash qilinmaydi - admin ko'ra olishi kerak
    });

    const waiters = await Waiter.find().sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantni yangilash
router.put("/waiters/:id", cors(), async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, password } = req.body;

    // Agar telefon raqam o'zgartirilsa, unikal ekanligini tekshirish
    if (phone) {
      const existingWaiter = await Waiter.findOne({
        phone,
        _id: { $ne: id }
      });
      if (existingWaiter) {
        return res.status(400).json({ error: "Bu telefon raqam allaqachon mavjud" });
      }
    }

    await Waiter.findByIdAndUpdate(id, {
      firstName,
      lastName,
      phone,
      password,
    });

    const waiters = await Waiter.find().sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantni o'chirish
router.delete("/waiters/:id", cors(), async (req, res) => {
  try {
    const { id } = req.params;
    await Waiter.findByIdAndRemove(id);
    const waiters = await Waiter.find().sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyant statusini o'zgartirish (active/inactive)
router.patch("/waiters/:id/toggle-status", cors(), async (req, res) => {
  try {
    const { id } = req.params;
    const waiter = await Waiter.findById(id);

    if (!waiter) {
      return res.status(404).json({ error: "Ofitsiyant topilmadi" });
    }

    waiter.isActive = !waiter.isActive;
    await waiter.save();

    const waiters = await Waiter.find().sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
