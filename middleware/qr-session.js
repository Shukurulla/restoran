const QRSession = require("../models/qr-session");
const Restaurant = require("../models/restaurant");

// QR sessiya tekshirish middleware
const validateQRSession = async (req, res, next) => {
  try {
    const sessionToken =
      req.headers["x-session-token"] || req.query.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: "Sessiya topilmadi",
        code: "NO_SESSION",
        message: "Iltimos, QR kodni skanerlang",
      });
    }

    const session = await QRSession.findOne({
      sessionToken,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .populate("tableId")
      .populate("restaurantId");

    if (!session) {
      return res.status(401).json({
        error: "Sessiya tugagan",
        code: "SESSION_EXPIRED",
        message: "Sessiyangiz tugagan. Iltimos, QR kodni qayta skanerlang.",
      });
    }

    // Restoran obuna holatini tekshirish
    const restaurant = session.restaurantId;
    if (restaurant) {
      const subscriptionStatus = restaurant.checkSubscription();
      if (subscriptionStatus.status === "blocked") {
        return res.status(403).json({
          error: "Restoran xizmati vaqtincha to'xtatilgan",
          code: "RESTAURANT_BLOCKED",
        });
      }
    }

    // Oxirgi faollik vaqtini yangilash
    session.lastActivityAt = new Date();
    await session.save();

    req.qrSession = session;
    req.table = session.tableId;
    req.restaurantId = session.restaurantId._id;
    req.restaurant = session.restaurantId;

    next();
  } catch (error) {
    console.error("Session validation error:", error);
    return res.status(500).json({ error: "Server xatosi" });
  }
};

// Sessiya mavjudligini tekshirish (majburiy emas)
const optionalSessionCheck = async (req, res, next) => {
  try {
    const sessionToken =
      req.headers["x-session-token"] || req.query.sessionToken;

    if (sessionToken) {
      const session = await QRSession.findOne({
        sessionToken,
        status: "active",
        expiresAt: { $gt: new Date() },
      })
        .populate("tableId")
        .populate("restaurantId");

      if (session) {
        req.qrSession = session;
        req.table = session.tableId;
        req.restaurantId = session.restaurantId._id;
        req.restaurant = session.restaurantId;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  validateQRSession,
  optionalSessionCheck,
};
