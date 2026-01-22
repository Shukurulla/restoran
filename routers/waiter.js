const express = require("express");
const Waiter = require("../models/waiter");
const router = express.Router();
const cors = require("cors");
const { authenticateRestaurantAdmin } = require("../middleware/auth");

// Barcha ofitsiyantlarni olish (restoran bo'yicha)
router.get("/waiters", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const waiters = await Waiter.find({ restaurantId }).sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yangi ofitsiyant qo'shish
router.post("/waiters", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { firstName, lastName, phone, password } = req.body;
    const restaurantId = req.user.restaurantId;

    // Telefon raqami mavjudligini tekshirish (shu restoran ichida)
    const existingWaiter = await Waiter.findOne({ phone, restaurantId });
    if (existingWaiter) {
      return res.status(400).json({ error: "Bu telefon raqam allaqachon mavjud" });
    }

    const waiter = await Waiter.create({
      firstName,
      lastName,
      phone,
      password,
      restaurantId,
    });

    const waiters = await Waiter.find({ restaurantId }).sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantni yangilash
router.put("/waiters/:id", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, password } = req.body;
    const restaurantId = req.user.restaurantId;

    // Agar telefon raqam o'zgartirilsa, unikal ekanligini tekshirish
    if (phone) {
      const existingWaiter = await Waiter.findOne({
        phone,
        restaurantId,
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

    const waiters = await Waiter.find({ restaurantId }).sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyantni o'chirish
router.delete("/waiters/:id", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user.restaurantId;
    await Waiter.findByIdAndRemove(id);
    const waiters = await Waiter.find({ restaurantId }).sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ofitsiyant statusini o'zgartirish (active/inactive)
router.patch("/waiters/:id/toggle-status", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user.restaurantId;
    const waiter = await Waiter.findOne({ _id: id, restaurantId });

    if (!waiter) {
      return res.status(404).json({ error: "Ofitsiyant topilmadi" });
    }

    waiter.isActive = !waiter.isActive;
    await waiter.save();

    const waiters = await Waiter.find({ restaurantId }).sort({ createdAt: -1 });
    res.json({ data: waiters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
