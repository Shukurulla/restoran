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
      const { firstName, lastName, phone, password, role, assignedCategories, salaryPercent } = req.body;

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

      const staffData = {
        restaurantId: req.restaurantId,
        firstName,
        lastName,
        phone,
        password,
        role: staffRole,
      };

      // Cook uchun - biriktirilgan categorylar
      if (staffRole === "cook" && assignedCategories) {
        staffData.assignedCategories = assignedCategories;
      }

      // Waiter uchun - ish haqi foizi
      if (staffRole === "waiter" && salaryPercent !== undefined) {
        staffData.salaryPercent = salaryPercent;
      }

      const staff = await Staff.create(staffData);

      res.json({
        success: true,
        staff: {
          id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          phone: staff.phone,
          role: staff.role,
          status: staff.status,
          assignedCategories: staff.assignedCategories,
          salaryPercent: staff.salaryPercent,
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
      const { firstName, lastName, phone, password, assignedCategories, salaryPercent } = req.body;

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

      // Cook uchun - biriktirilgan categorylar
      if (staff.role === "cook" && assignedCategories !== undefined) {
        staff.assignedCategories = assignedCategories;
      }

      // Waiter uchun - ish haqi foizi
      if (staff.role === "waiter" && salaryPercent !== undefined) {
        staff.salaryPercent = salaryPercent;
      }

      const savedStaff = await staff.save();

      res.json({
        success: true,
        staff: {
          id: savedStaff._id,
          firstName: savedStaff.firstName,
          lastName: savedStaff.lastName,
          phone: savedStaff.phone,
          role: savedStaff.role,
          status: savedStaff.status,
          assignedCategories: savedStaff.assignedCategories,
          salaryPercent: savedStaff.salaryPercent,
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

// ============ WAITER BATAFSIL SAHIFA ============
const KitchenOrder = require("../models/kitchen-order");
const Table = require("../models/table");

// Waiter batafsil ma'lumotlari - ish haqi, orderlar, zarar
router.get(
  "/restaurant-admin/staff/:staffId/details",
  authenticateRestaurantAdmin,
  async (req, res) => {
    try {
      const { staffId } = req.params;
      const { date } = req.query; // YYYY-MM-DD format, default bugun

      const staff = await Staff.findOne({
        _id: staffId,
        restaurantId: req.restaurantId,
      });

      if (!staff) {
        return res.status(404).json({ error: "Xodim topilmadi" });
      }

      // Sana filter
      let startOfDay, endOfDay;
      if (date) {
        startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
      } else {
        // Bugun
        startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
      }

      // Waiter'ning bugungi orderlari
      const orders = await KitchenOrder.find({
        waiterId: staffId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        isPaid: true, // Faqat to'langan orderlar
      });

      // Ish haqi hisoblash
      // Formula: (orderSumm + orderSumm*0.1) * salaryPercent/100
      let totalOrdersSum = 0;
      let totalServiceFee = 0;
      let totalWithService = 0;

      orders.forEach((order) => {
        const orderSum = order.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const serviceFee = orderSum * 0.1; // 10% xizmat haqi
        const withService = orderSum + serviceFee;

        totalOrdersSum += orderSum;
        totalServiceFee += serviceFee;
        totalWithService += withService;
      });

      // Waiter'ning foizi bo'yicha ish haqi
      const salaryPercent = staff.salaryPercent || 5;
      const salaryEarned = totalWithService * (salaryPercent / 100);

      // Waiter'ning biriktirilgan stollari
      const assignedTables = await Table.find({
        assignedWaiter: staffId,
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
          salaryPercent: salaryPercent,
          isWorking: staff.isWorking,
        },
        stats: {
          date: date || new Date().toISOString().split("T")[0],
          totalOrders: orders.length,
          totalOrdersSum: totalOrdersSum,
          totalServiceFee: totalServiceFee,
          totalWithService: totalWithService,
          salaryPercent: salaryPercent,
          salaryEarned: Math.round(salaryEarned),
        },
        orders: orders.map((order) => ({
          id: order._id,
          tableName: order.tableName,
          items: order.items,
          totalSum: order.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),
          createdAt: order.createdAt,
          paidAt: order.paidAt,
          paymentMethod: order.paymentMethod,
        })),
        assignedTables: assignedTables.map((table) => ({
          id: table._id,
          tableName: table.tableName,
          tableNumber: table.tableNumber,
        })),
      });
    } catch (error) {
      console.error("Get staff details error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

module.exports = router;
