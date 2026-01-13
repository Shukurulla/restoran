const Restaurant = require("../models/restaurant");

// Restoran mavjud va faol ekanligini tekshirish
const checkRestaurantActive = async (req, res, next) => {
  try {
    const restaurantId =
      req.restaurantId || req.params.restaurantId || req.body.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Restoran ID topilmadi" });
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: "Restoran topilmadi" });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({ error: "Restoran faol emas" });
    }

    // Obuna holatini tekshirish
    const subscriptionStatus = restaurant.checkSubscription();

    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran obunasi tugagan",
        subscriptionExpired: true,
        daysOverdue: Math.abs(subscriptionStatus.daysLeft),
      });
    }

    req.restaurant = restaurant;
    req.subscriptionStatus = subscriptionStatus;

    next();
  } catch (error) {
    console.error("Restaurant check error:", error);
    return res.status(500).json({ error: "Server xatosi" });
  }
};

// Restoran slug orqali tekshirish
const checkRestaurantBySlug = async (req, res, next) => {
  try {
    const { restaurantSlug } = req.params;

    if (!restaurantSlug) {
      return res.status(400).json({ error: "Restoran slug topilmadi" });
    }

    const restaurant = await Restaurant.findOne({ slug: restaurantSlug });

    if (!restaurant) {
      return res.status(404).json({ error: "Restoran topilmadi" });
    }

    if (!restaurant.isActive) {
      return res.status(403).json({ error: "Restoran faol emas" });
    }

    // Obuna holatini tekshirish
    const subscriptionStatus = restaurant.checkSubscription();

    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran xizmati vaqtincha to'xtatilgan",
        subscriptionExpired: true,
      });
    }

    req.restaurant = restaurant;
    req.restaurantId = restaurant._id;
    req.subscriptionStatus = subscriptionStatus;

    next();
  } catch (error) {
    console.error("Restaurant slug check error:", error);
    return res.status(500).json({ error: "Server xatosi" });
  }
};

module.exports = {
  checkRestaurantActive,
  checkRestaurantBySlug,
};
