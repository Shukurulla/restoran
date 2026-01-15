const express = require("express");
const router = express.Router();
const Restaurant = require("../models/restaurant");
const RestaurantAdmin = require("../models/restaurant-admin");
const Staff = require("../models/staff");
const Table = require("../models/table");
const { generateToken } = require("../middleware/auth");
const { DEMO_SLUG, DEMO_PASSWORD } = require("../seeds/demo-restaurant.seed");

// Demo restoran ma'lumotlarini olish
router.get("/demo/info", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    // Birinchi stolni olish
    const firstTable = await Table.findOne({ restaurantId: restaurant._id }).sort({ tableNumber: 1 });

    res.json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      firstTableId: firstTable?._id || null
    });
  } catch (error) {
    console.error("Demo info error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Demo Admin uchun auto-login token olish
router.get("/demo/token/admin", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    const admin = await RestaurantAdmin.findOne({ restaurantId: restaurant._id });

    if (!admin) {
      return res.status(404).json({ error: "Demo admin topilmadi" });
    }

    const token = generateToken({
      id: admin._id,
      restaurantId: restaurant._id,
      role: "restaurant_admin"
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo
      }
    });
  } catch (error) {
    console.error("Demo admin token error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Demo Oshpaz uchun auto-login token olish
router.get("/demo/token/cook", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    const cook = await Staff.findOne({
      restaurantId: restaurant._id,
      role: "cook",
      status: "working"
    });

    if (!cook) {
      return res.status(404).json({ error: "Demo oshpaz topilmadi" });
    }

    const token = generateToken({
      id: cook._id,
      restaurantId: restaurant._id,
      role: "cook"
    });

    res.json({
      success: true,
      token,
      staff: {
        id: cook._id,
        firstName: cook.firstName,
        lastName: cook.lastName,
        phone: cook.phone,
        role: cook.role
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug
      }
    });
  } catch (error) {
    console.error("Demo cook token error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Demo Kassir uchun auto-login token olish
router.get("/demo/token/cashier", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    const cashier = await Staff.findOne({
      restaurantId: restaurant._id,
      role: "cashier",
      status: "working"
    });

    if (!cashier) {
      return res.status(404).json({ error: "Demo kassir topilmadi" });
    }

    const token = generateToken({
      id: cashier._id,
      restaurantId: restaurant._id,
      role: "cashier"
    });

    res.json({
      success: true,
      token,
      staff: {
        id: cashier._id,
        firstName: cashier.firstName,
        lastName: cashier.lastName,
        phone: cashier.phone,
        role: cashier.role
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug
      }
    });
  } catch (error) {
    console.error("Demo cashier token error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Demo Ofitsiant uchun auto-login token olish (birinchi ofitsiant)
router.get("/demo/token/waiter", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    const waiter = await Staff.findOne({
      restaurantId: restaurant._id,
      role: "waiter",
      status: "working"
    }).sort({ createdAt: 1 });

    if (!waiter) {
      return res.status(404).json({ error: "Demo ofitsiant topilmadi" });
    }

    const token = generateToken({
      id: waiter._id,
      restaurantId: restaurant._id,
      role: "waiter"
    });

    res.json({
      success: true,
      token,
      staff: {
        id: waiter._id,
        firstName: waiter.firstName,
        lastName: waiter.lastName,
        phone: waiter.phone,
        role: waiter.role
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug
      }
    });
  } catch (error) {
    console.error("Demo waiter token error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Demo order qilish uchun session ma'lumotlari
router.get("/demo/order-session", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ slug: DEMO_SLUG });

    if (!restaurant) {
      return res.status(404).json({ error: "Demo restoran topilmadi" });
    }

    // Birinchi stolni olish
    const firstTable = await Table.findOne({ restaurantId: restaurant._id }).sort({ tableNumber: 1 });

    if (!firstTable) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    // Demo session token yaratish
    const sessionToken = `demo_session_${Date.now()}`;

    res.json({
      success: true,
      restaurantId: restaurant._id,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name,
      tableId: firstTable._id,
      tableName: firstTable.title,
      tableNumber: firstTable.tableNumber,
      sessionToken
    });
  } catch (error) {
    console.error("Demo order session error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

module.exports = router;
