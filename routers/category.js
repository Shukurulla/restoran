const express = require("express");
const Category = require("../models/category");
const router = express.Router();
const cors = require("cors");
const { authenticateRestaurantAdmin, authenticateStaff } = require("../middleware/auth");

router.get("/categories", cors(), authenticateRestaurantAdmin, async (req, res) => {
  const categories = await Category.find({ restaurantId: req.restaurantId });
  res.json({ data: categories });
});

// Waiter uchun kategoriyalarni olish
router.get("/waiter/categories", cors(), authenticateStaff, async (req, res) => {
  try {
    const categories = await Category.find({ restaurantId: req.restaurantId });
    res.json({ data: categories });
  } catch (error) {
    console.error("Waiter categories error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/categories", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      restaurantId: req.restaurantId,
    };
    await Category.create(categoryData);
    const categories = await Category.find({ restaurantId: req.restaurantId });
    res.json({ data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/edit-category/:id", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findOne({ _id: id, restaurantId: req.restaurantId });
    if (!category) {
      return res.status(404).json({ error: "Kategoriya topilmadi" });
    }
    await Category.findByIdAndUpdate(id, req.body);
    const categories = await Category.find({ restaurantId: req.restaurantId });
    res.json({ data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/delete-category/:id", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findOne({ _id: id, restaurantId: req.restaurantId });
    if (!category) {
      return res.status(404).json({ error: "Kategoriya topilmadi" });
    }
    await Category.findByIdAndRemove(id);
    const categories = await Category.find({ restaurantId: req.restaurantId });
    res.json({ data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
