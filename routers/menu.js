const express = require("express");
const router = express.Router();
const Food = require("../models/foods");
const Category = require("../models/category");
const { validateQRSession } = require("../middleware/qr-session");

// QR session orqali taomlar olish (mijozlar uchun)
router.get("/menu/foods", validateQRSession, async (req, res) => {
  try {
    const foods = await Food.find({
      restaurantId: req.restaurantId,
      isAvailable: { $ne: false },
    });
    res.json({ data: foods });
  } catch (error) {
    console.error("Menu foods error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// QR session orqali kategoriyalar olish (mijozlar uchun)
router.get("/menu/categories", validateQRSession, async (req, res) => {
  try {
    const categories = await Category.find({ restaurantId: req.restaurantId });
    res.json({ data: categories });
  } catch (error) {
    console.error("Menu categories error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

module.exports = router;
