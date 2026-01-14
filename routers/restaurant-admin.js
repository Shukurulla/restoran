const express = require("express");
const router = express.Router();
const RestaurantAdmin = require("../models/restaurant-admin");
const Staff = require("../models/staff");
const Restaurant = require("../models/restaurant");
const {
  generateToken,
  authenticateRestaurantAdmin,
} = require("../middleware/auth");

// Restoran Admin Login
router.post("/restaurant-admin/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const admin = await RestaurantAdmin.findOne({ phone }).populate(
      "restaurantId"
    );

    if (!admin) {
      return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Telefon yoki parol noto'g'ri" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ error: "Sizning akkauntingiz faol emas" });
    }

    // Restoran obuna holatini tekshirish
    const restaurant = admin.restaurantId;
    const subscriptionStatus = restaurant.checkSubscription();

    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran obunasi tugagan. Iltimos, admin bilan bog'laning.",
        subscriptionExpired: true,
      });
    }

    const token = generateToken({
      id: admin._id,
      restaurantId: restaurant._id,
      role: "restaurant_admin",
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
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
    console.error("Restaurant admin login error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Restoran ma'lumotlarini olish
router.get(
  "/restaurant-admin/restaurant",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const restaurant = req.restaurant;

      res.json({
        restaurant,
        subscription: req.subscriptionStatus,
      });
    } catch (error) {
      console.error("Get restaurant error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Xodimlar ro'yxati
router.get(
  "/restaurant-admin/staff",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const { role, status } = req.query;

      const query = { restaurantId: req.restaurantId };
      if (role) query.role = role;
      if (status) query.status = status;

      const staff = await Staff.find(query).sort({ createdAt: -1 });

      res.json({ staff });
    } catch (error) {
      console.error("Get staff error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Yangi xodim qo'shish (waiter, cook, cashier)
router.post(
  "/restaurant-admin/staff",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const { firstName, lastName, phone, password, role } = req.body;

      // Role validatsiya
      const validRoles = ["waiter", "cook", "cashier"];
      const staffRole = validRoles.includes(role) ? role : "waiter";

      // Telefon raqami boshqa restoranda ishlamoqdami tekshirish
      const existingStaff = await Staff.findOne({ phone, status: "working" });

      if (existingStaff) {
        return res.status(400).json({
          error:
            "Bu telefon raqami boshqa restoranda ro'yxatdan o'tgan va hozirda ishlayapti",
        });
      }

      const staff = await Staff.create({
        restaurantId: req.restaurantId,
        firstName,
        lastName,
        phone,
        password,
        role: staffRole,
      });

      res.json({
        success: true,
        staff: {
          id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
        },
      });
    } catch (error) {
      console.error("Create staff error:", error);
      if (error.code === 11000) {
        return res.status(400).json({
          error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan",
        });
      }
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Xodim ma'lumotlarini yangilash
router.put(
  "/restaurant-admin/staff/:staffId",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const { firstName, lastName, phone, password } = req.body;

      const staff = await Staff.findOne({
        _id: req.params.staffId,
        restaurantId: req.restaurantId,
      });

      if (!staff) {
        return res.status(404).json({ error: "Xodim topilmadi" });
      }

      // Agar telefon raqami o'zgargan bo'lsa, uniqueligini tekshirish
      if (phone && phone !== staff.phone) {
        const existingStaff = await Staff.findOne({ phone, status: "working" });
        if (existingStaff) {
          return res.status(400).json({
            error: "Bu telefon raqami boshqa xodimga tegishli",
          });
        }
      }

      staff.firstName = firstName || staff.firstName;
      staff.lastName = lastName || staff.lastName;
      staff.phone = phone || staff.phone;

      if (password) {
        staff.password = password;
      }

      await staff.save();

      res.json({
        success: true,
        staff: {
          id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
        },
      });
    } catch (error) {
      console.error("Update staff error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Xodim statusini o'zgartirish (ishdan bo'shatish/qaytarish)
router.patch(
  "/restaurant-admin/staff/:staffId/status",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!["working", "fired"].includes(status)) {
        return res.status(400).json({ error: "Noto'g'ri status" });
      }

      const staff = await Staff.findOne({
        _id: req.params.staffId,
        restaurantId: req.restaurantId,
      });

      if (!staff) {
        return res.status(404).json({ error: "Xodim topilmadi" });
      }

      // Agar ishdan bo'shatilsa, socketdan chiqarish
      if (status === "fired") {
        staff.isOnline = false;
        staff.socketId = null;
      }

      staff.status = status;
      await staff.save();

      res.json({
        success: true,
        staff: {
          id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
        },
      });
    } catch (error) {
      console.error("Update staff status error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Xodimni o'chirish (waiter, cook, cashier)
router.delete(
  "/restaurant-admin/staff/:staffId",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const staff = await Staff.findOne({
        _id: req.params.staffId,
        restaurantId: req.restaurantId,
      });

      if (!staff) {
        return res.status(404).json({ error: "Xodim topilmadi" });
      }

      await staff.deleteOne();

      res.json({ success: true, message: "Xodim o'chirildi" });
    } catch (error) {
      console.error("Delete staff error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Telefon raqami tekshirish (global unique)
router.get("/staff/check-phone/:phone", async (req, res) => {
  try {
    const { phone } = req.params;

    const existingStaff = await Staff.findOne({
      phone,
      status: "working",
    }).populate("restaurantId", "name");

    if (existingStaff) {
      return res.json({
        exists: true,
        restaurant: existingStaff.restaurantId?.name || "Noma'lum",
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error("Check phone error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

module.exports = router;
