const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/super-admin");
const RestaurantAdmin = require("../models/restaurant-admin");
const Staff = require("../models/staff");
const Restaurant = require("../models/restaurant");

// JWT token yaratish
const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, process.env.JWT_SECRET || "restaurant_secret_key", {
    expiresIn,
  });
};

// JWT tokenni tekshirish
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || "restaurant_secret_key");
};

// Super Admin autentifikatsiya middleware
const authenticateSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token topilmadi" });
    }

    const decoded = verifyToken(token);

    if (decoded.role !== "super_admin") {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    const admin = await SuperAdmin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ error: "Admin topilmadi" });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Super admin auth error:", error);
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
};

// Restoran Admin autentifikatsiya middleware
const authenticateRestaurantAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token topilmadi" });
    }

    const decoded = verifyToken(token);

    if (decoded.role !== "restaurant_admin") {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    const admin = await RestaurantAdmin.findById(decoded.id).populate(
      "restaurantId"
    );
    if (!admin) {
      return res.status(401).json({ error: "Admin topilmadi" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ error: "Admin faol emas" });
    }

    // Restoran obuna holatini tekshirish
    const restaurant = admin.restaurantId;
    if (restaurant) {
      const subscriptionStatus = restaurant.checkSubscription();
      if (subscriptionStatus.status === "blocked") {
        return res.status(403).json({
          error: "Restoran obunasi tugagan",
          subscriptionExpired: true,
        });
      }
      req.subscriptionStatus = subscriptionStatus;
    }

    req.admin = admin;
    req.restaurantId = admin.restaurantId._id;
    req.restaurant = admin.restaurantId;
    next();
  } catch (error) {
    console.error("Restaurant admin auth error:", error);
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
};

// Xodim (waiter, cook, cashier) autentifikatsiya middleware
const authenticateStaff = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token topilmadi" });
    }

    const decoded = verifyToken(token);

    if (!["waiter", "cook", "cashier"].includes(decoded.role)) {
      return res.status(403).json({ error: "Ruxsat yo'q" });
    }

    const staff = await Staff.findById(decoded.id).populate("restaurantId");
    if (!staff) {
      return res.status(401).json({ error: "Xodim topilmadi" });
    }

    if (staff.status !== "working") {
      return res.status(403).json({ error: "Siz ishdan bo'shatilgansiz" });
    }

    // Restoran obuna holatini tekshirish
    const restaurant = staff.restaurantId;
    if (restaurant) {
      const subscriptionStatus = restaurant.checkSubscription();
      if (subscriptionStatus.status === "blocked") {
        return res.status(403).json({
          error: "Restoran obunasi tugagan",
          subscriptionExpired: true,
        });
      }
      req.subscriptionStatus = subscriptionStatus;
    }

    req.staff = staff;
    req.restaurantId = staff.restaurantId._id;
    req.restaurant = staff.restaurantId;
    next();
  } catch (error) {
    console.error("Staff auth error:", error);
    return res.status(401).json({ error: "Token yaroqsiz" });
  }
};

// Ixtiyoriy autentifikatsiya (token bor bo'lsa tekshiradi, yo'q bo'lsa davom etadi)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (token) {
      const decoded = verifyToken(token);
      req.userId = decoded.id;
      req.userRole = decoded.role;
    }

    next();
  } catch (error) {
    // Token yaroqsiz bo'lsa ham davom etamiz
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateSuperAdmin,
  authenticateRestaurantAdmin,
  authenticateStaff,
  optionalAuth,
};
