const express = require("express");
const router = express.Router();
const Staff = require("../models/staff");
const Restaurant = require("../models/restaurant");
const { generateToken, authenticateStaff } = require("../middleware/auth");

// Xodim Login (waiter, cook, cashier)
router.post("/staff/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const staff = await Staff.findOne({ phone }).populate("restaurantId");

    if (!staff) {
      return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
    }

    const isMatch = await staff.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
    }

    if (staff.status !== "working") {
      return res.status(403).json({ error: "Siz ishdan bo'shatilgansiz" });
    }

    // Restoran obuna holatini tekshirish
    const restaurant = staff.restaurantId;
    if (!restaurant) {
      return res.status(404).json({ error: "Restoran topilmadi" });
    }

    const subscriptionStatus = restaurant.checkSubscription();

    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran obunasi tugagan. Iltimos, admin bilan bog'laning.",
        subscriptionExpired: true,
      });
    }

    const token = generateToken({
      id: staff._id,
      restaurantId: restaurant._id,
      role: staff.role,
    });

    res.json({
      success: true,
      token,
      staff: {
        id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        role: staff.role,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo,
      },
      subscription: subscriptionStatus,
    });
  } catch (error) {
    console.error("Staff login error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Xodim profilini olish
router.get("/staff/profile", authenticateStaff, async (req, res) => {
  try {
    const staff = req.staff;
    const restaurant = req.restaurant;

    res.json({
      staff: {
        id: staff._id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        role: staff.role,
        status: staff.status,
        isOnline: staff.isOnline,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        logo: restaurant.logo,
      },
      subscription: req.subscriptionStatus,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Parolni o'zgartirish
router.post("/staff/change-password", authenticateStaff, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const staff = req.staff;

    const isMatch = await staff.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "Joriy parol noto'g'ri" });
    }

    staff.password = newPassword;
    await staff.save();

    res.json({ success: true, message: "Parol o'zgartirildi" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Online statusni yangilash
router.patch("/staff/online-status", authenticateStaff, async (req, res) => {
  try {
    const { isOnline, socketId } = req.body;
    const staff = req.staff;

    staff.isOnline = isOnline;
    staff.socketId = socketId || null;
    await staff.save();

    res.json({
      success: true,
      isOnline: staff.isOnline,
    });
  } catch (error) {
    console.error("Update online status error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// FCM tokenni yangilash
router.patch("/staff/:staffId/fcm-token", async (req, res) => {
  try {
    const { staffId } = req.params;
    const { fcmToken } = req.body;

    const staff = await Staff.findByIdAndUpdate(
      staffId,
      { fcmToken: fcmToken || null },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({ error: "Xodim topilmadi" });
    }

    console.log(`FCM token updated for staff ${staffId}: ${fcmToken ? 'set' : 'cleared'}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Update FCM token error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Restoran xodimlari (bitta restoran ichida)
router.get("/staff/colleagues", authenticateStaff, async (req, res) => {
  try {
    const staff = await Staff.find({
      restaurantId: req.restaurantId,
      status: "working",
    }).select("firstName lastName role isOnline");

    res.json({ staff });
  } catch (error) {
    console.error("Get colleagues error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

module.exports = router;
