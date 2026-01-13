const express = require("express");
const router = express.Router();
const SuperAdmin = require("../models/super-admin");
const Restaurant = require("../models/restaurant");
const RestaurantAdmin = require("../models/restaurant-admin");
const Staff = require("../models/staff");
const Order = require("../models/order");
const KitchenOrder = require("../models/kitchen-order");
const { generateToken, authenticateSuperAdmin } = require("../middleware/auth");

// Super Admin Login
router.post("/super-admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await SuperAdmin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: "Username yoki parol noto'g'ri" });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Username yoki parol noto'g'ri" });
    }

    const token = generateToken({
      id: admin._id,
      username: admin.username,
      role: "super_admin",
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Super admin login error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Super Admin yaratish (bir martalik - faqat birinchi marta)
router.post("/super-admin/setup", async (req, res) => {
  try {
    const existingAdmin = await SuperAdmin.findOne();
    if (existingAdmin) {
      return res.status(400).json({ error: "Super admin allaqachon mavjud" });
    }

    const { username, password } = req.body;

    const admin = await SuperAdmin.create({
      username,
      password,
    });

    res.json({
      success: true,
      message: "Super admin yaratildi",
      admin: {
        id: admin._id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Super admin setup error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Dashboard statistikasi
router.get(
  "/super-admin/dashboard/stats",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const totalRestaurants = await Restaurant.countDocuments();
      const activeRestaurants = await Restaurant.countDocuments({
        isActive: true,
        "subscription.status": "active",
      });
      const warningRestaurants = await Restaurant.countDocuments({
        "subscription.status": "warning",
      });
      const blockedRestaurants = await Restaurant.countDocuments({
        "subscription.status": "blocked",
      });

      // Bugungi savdo
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaySales = await KitchenOrder.aggregate([
        {
          $match: {
            isPaid: true,
            paidAt: { $gte: today },
          },
        },
        {
          $unwind: "$items",
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          },
        },
      ]);

      // Jami xodimlar
      const totalStaff = await Staff.countDocuments({ status: "working" });

      res.json({
        totalRestaurants,
        activeRestaurants,
        warningRestaurants,
        blockedRestaurants,
        todaySales: todaySales[0]?.total || 0,
        totalStaff,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Restoranlar ro'yxati
router.get(
  "/super-admin/restaurants",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, search, status } = req.query;

      const query = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      if (status) {
        query["subscription.status"] = status;
      }

      const restaurants = await Restaurant.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Restaurant.countDocuments(query);

      // Har bir restoran uchun qo'shimcha ma'lumotlar
      const restaurantsWithStats = await Promise.all(
        restaurants.map(async (restaurant) => {
          const staffCount = await Staff.countDocuments({
            restaurantId: restaurant._id,
            status: "working",
          });

          // Bugungi savdo
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const todaySales = await KitchenOrder.aggregate([
            {
              $match: {
                restaurantId: restaurant._id,
                isPaid: true,
                paidAt: { $gte: today },
              },
            },
            {
              $unwind: "$items",
            },
            {
              $group: {
                _id: null,
                total: {
                  $sum: { $multiply: ["$items.price", "$items.quantity"] },
                },
              },
            },
          ]);

          return {
            ...restaurant.toObject(),
            staffCount,
            todaySales: todaySales[0]?.total || 0,
            subscriptionStatus: restaurant.checkSubscription(),
          };
        })
      );

      res.json({
        restaurants: restaurantsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get restaurants error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Yangi restoran yaratish
router.post(
  "/super-admin/restaurants",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const {
        name,
        address,
        phone,
        logo,
        subscriptionPlan,
        subscriptionMonths,
        subscriptionPrice,
        adminFirstName,
        adminLastName,
        adminPhone,
        adminPassword,
      } = req.body;

      // Slug yaratish
      let slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Slug unique ekanligini tekshirish
      const existingSlug = await Restaurant.findOne({ slug });
      if (existingSlug) {
        slug = `${slug}-${Date.now()}`;
      }

      // Admin telefon raqami unique ekanligini tekshirish
      const existingAdminPhone = await RestaurantAdmin.findOne({
        phone: adminPhone,
      });
      if (existingAdminPhone) {
        return res.status(400).json({
          error: "Bu telefon raqami bilan admin allaqachon mavjud",
        });
      }

      // Obuna tugash sanasini hisoblash
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (subscriptionMonths || 1));

      // Restoran yaratish
      const restaurant = await Restaurant.create({
        name,
        slug,
        address,
        phone,
        logo,
        subscription: {
          plan: subscriptionPlan || "basic",
          startDate: new Date(),
          endDate,
          price: subscriptionPrice || 0,
          status: "active",
        },
      });

      // Restoran admin yaratish
      const restaurantAdmin = await RestaurantAdmin.create({
        restaurantId: restaurant._id,
        firstName: adminFirstName,
        lastName: adminLastName,
        phone: adminPhone,
        password: adminPassword,
      });

      // Default povar yaratish
      const cook = await Staff.create({
        restaurantId: restaurant._id,
        firstName: "Oshpaz",
        lastName: restaurant.name,
        phone: `cook_${restaurant._id}`,
        password: "cook123",
        role: "cook",
      });

      // Default kassir yaratish
      const cashier = await Staff.create({
        restaurantId: restaurant._id,
        firstName: "Kassir",
        lastName: restaurant.name,
        phone: `cashier_${restaurant._id}`,
        password: "cashier123",
        role: "cashier",
      });

      res.json({
        success: true,
        restaurant,
        admin: {
          id: restaurantAdmin._id,
          firstName: restaurantAdmin.firstName,
          lastName: restaurantAdmin.lastName,
          phone: restaurantAdmin.phone,
        },
        defaultStaff: {
          cook: { id: cook._id, phone: cook.phone, password: "cook123" },
          cashier: {
            id: cashier._id,
            phone: cashier.phone,
            password: "cashier123",
          },
        },
      });
    } catch (error) {
      console.error("Create restaurant error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Restoran ma'lumotlarini olish
router.get(
  "/super-admin/restaurants/:id",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const restaurant = await Restaurant.findById(req.params.id);

      if (!restaurant) {
        return res.status(404).json({ error: "Restoran topilmadi" });
      }

      const admin = await RestaurantAdmin.findOne({
        restaurantId: restaurant._id,
      });
      const staff = await Staff.find({
        restaurantId: restaurant._id,
        status: "working",
      });

      // Savdo statistikasi
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const [todaySales, monthSales] = await Promise.all([
        KitchenOrder.aggregate([
          {
            $match: {
              restaurantId: restaurant._id,
              isPaid: true,
              paidAt: { $gte: today },
            },
          },
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              total: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
            },
          },
        ]),
        KitchenOrder.aggregate([
          {
            $match: {
              restaurantId: restaurant._id,
              isPaid: true,
              paidAt: { $gte: thisMonth },
            },
          },
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              total: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
            },
          },
        ]),
      ]);

      res.json({
        restaurant: {
          ...restaurant.toObject(),
          subscriptionStatus: restaurant.checkSubscription(),
        },
        admin: admin
          ? {
              id: admin._id,
              firstName: admin.firstName,
              lastName: admin.lastName,
              phone: admin.phone,
            }
          : null,
        staff,
        stats: {
          todaySales: todaySales[0]?.total || 0,
          monthSales: monthSales[0]?.total || 0,
          staffCount: staff.length,
        },
      });
    } catch (error) {
      console.error("Get restaurant error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Restoran yangilash
router.put(
  "/super-admin/restaurants/:id",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const { name, address, phone, logo, isActive } = req.body;

      const restaurant = await Restaurant.findByIdAndUpdate(
        req.params.id,
        { name, address, phone, logo, isActive },
        { new: true }
      );

      if (!restaurant) {
        return res.status(404).json({ error: "Restoran topilmadi" });
      }

      res.json({ success: true, restaurant });
    } catch (error) {
      console.error("Update restaurant error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Obunani yangilash
router.patch(
  "/super-admin/restaurants/:id/subscription",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const { plan, months, price } = req.body;

      const restaurant = await Restaurant.findById(req.params.id);

      if (!restaurant) {
        return res.status(404).json({ error: "Restoran topilmadi" });
      }

      // Yangi tugash sanasini hisoblash
      const newEndDate = new Date();
      if (restaurant.subscription.status !== "blocked") {
        // Agar obuna hali tugamagan bo'lsa, mavjud sanadan uzaytirish
        newEndDate.setTime(
          Math.max(
            restaurant.subscription.endDate.getTime(),
            new Date().getTime()
          )
        );
      }
      newEndDate.setMonth(newEndDate.getMonth() + (months || 1));

      restaurant.subscription.plan = plan || restaurant.subscription.plan;
      restaurant.subscription.endDate = newEndDate;
      restaurant.subscription.price =
        price !== undefined ? price : restaurant.subscription.price;
      restaurant.subscription.status = "active";

      await restaurant.save();

      res.json({
        success: true,
        restaurant,
        subscriptionStatus: restaurant.checkSubscription(),
      });
    } catch (error) {
      console.error("Update subscription error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Restoran o'chirish
router.delete(
  "/super-admin/restaurants/:id",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const restaurant = await Restaurant.findById(req.params.id);

      if (!restaurant) {
        return res.status(404).json({ error: "Restoran topilmadi" });
      }

      // Bog'liq ma'lumotlarni o'chirish
      await Promise.all([
        RestaurantAdmin.deleteMany({ restaurantId: restaurant._id }),
        Staff.deleteMany({ restaurantId: restaurant._id }),
        // Qolgan ma'lumotlarni ham o'chirish mumkin
      ]);

      await restaurant.deleteOne();

      res.json({ success: true, message: "Restoran o'chirildi" });
    } catch (error) {
      console.error("Delete restaurant error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Barcha xodimlarni ko'rish (global)
router.get("/super-admin/staff", authenticateSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (role) query.role = role;
    if (status) query.status = status;

    const staff = await Staff.find(query)
      .populate("restaurantId", "name slug")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Staff.countDocuments(query);

    res.json({
      staff,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get staff error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Telefon raqami tekshirish
router.get(
  "/super-admin/staff/check-phone/:phone",
  authenticateSuperAdmin,
  async (req, res) => {
    try {
      const { phone } = req.params;

      const existingStaff = await Staff.findOne({
        phone,
        status: "working",
      }).populate("restaurantId", "name");

      if (existingStaff) {
        return res.json({
          exists: true,
          staff: {
            id: existingStaff._id,
            firstName: existingStaff.firstName,
            lastName: existingStaff.lastName,
            role: existingStaff.role,
            restaurant: existingStaff.restaurantId?.name,
          },
        });
      }

      res.json({ exists: false });
    } catch (error) {
      console.error("Check phone error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

module.exports = router;
