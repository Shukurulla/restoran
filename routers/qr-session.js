const express = require("express");
const router = express.Router();
const QRSession = require("../models/qr-session");
const PendingNonce = require("../models/pending-nonce");
const Table = require("../models/table");
const Restaurant = require("../models/restaurant");
const { checkRestaurantBySlug } = require("../middleware/restaurant-check");
const { validateQRSession } = require("../middleware/qr-session");

// Nonce olish (QR skanerlanganda) - Eski format: slug asosida
router.get(
  "/qr/:restaurantSlug/table/:tableId/nonce",
  checkRestaurantBySlug,
  async (req, res) => {
    try {
      const { tableId } = req.params;
      const restaurant = req.restaurant;

      // Stol mavjudligini tekshirish
      const table = await Table.findOne({
        _id: tableId,
        restaurantId: restaurant._id,
      });

      if (!table) {
        return res.status(404).json({ error: "Stol topilmadi" });
      }

      // Mavjud aktiv sessiya bormi tekshirish
      const existingSession = await QRSession.findOne({
        tableId: table._id,
        restaurantId: restaurant._id,
        status: "active",
        expiresAt: { $gt: new Date() },
      });

      // Nonce yaratish (5 daqiqa amal qiladi)
      const nonce = PendingNonce.generateNonce();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await PendingNonce.create({
        nonce,
        tableId: table._id,
        restaurantId: restaurant._id,
        expiresAt,
      });

      res.json({
        nonce,
        tableId: table._id,
        tableName: table.title,
        tableNumber: table.tableNumber,
        restaurant: {
          id: restaurant._id,
          name: restaurant.name,
          logo: restaurant.logo,
          phone: restaurant.phone,
          address: restaurant.address,
        },
        nonceExpiresIn: 300, // 5 daqiqa
        hasExistingSession: !!existingSession,
      });
    } catch (error) {
      console.error("Nonce generation error:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  }
);

// Nonce olish - Yangi format: tableId-restaurantId (tire bilan)
router.get("/qr/table/:tableData/nonce", async (req, res) => {
  const { tableData } = req.params;

  try {
    // tableId-restaurantId formatini parse qilish (tire yoki nuqta bilan)
    const parts = tableData.includes("-")
      ? tableData.split("-")
      : tableData.split(".");
    if (parts.length !== 2) {
      return res
        .status(400)
        .json({ error: "Noto'g'ri format. tableId-restaurantId kutilgan" });
    }

    const [tableId, restaurantId] = parts;

    // Restoranni tekshirish
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restoran topilmadi" });
    }

    // Obuna tekshirish
    const subscriptionStatus = restaurant.checkSubscription();
    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran xizmati vaqtincha to'xtatilgan",
        code: "RESTAURANT_BLOCKED",
      });
    }

    // Stol mavjudligini tekshirish
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: restaurant._id,
    });

    if (!table) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    // Mavjud aktiv sessiya bormi tekshirish
    const existingSession = await QRSession.findOne({
      tableId: table._id,
      restaurantId: restaurant._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    // Nonce yaratish (5 daqiqa amal qiladi)
    const nonce = PendingNonce.generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await PendingNonce.create({
      nonce,
      tableId: table._id,
      restaurantId: restaurant._id,
      expiresAt,
    });

    res.json({
      nonce,
      tableId: table._id,
      tableName: table.title,
      tableNumber: table.tableNumber,
      table: {
        id: table._id,
        title: table.title,
        tableNumber: table.tableNumber,
        surcharge: table.surcharge,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        logo: restaurant.logo,
        phone: restaurant.phone,
        address: restaurant.address,
        slug: restaurant.slug,
      },
      nonceExpiresIn: 300, // 5 daqiqa
      hasExistingSession: !!existingSession,
    });
  } catch (error) {
    console.error("Nonce generation error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Sessiya yaratish
router.post("/qr/session/create", async (req, res) => {
  try {
    const { nonce, tableId, clientHash } = req.body;

    // Nonce tekshirish
    const pendingNonce = await PendingNonce.findOneAndDelete({
      nonce,
      tableId,
      expiresAt: { $gt: new Date() },
    });

    if (!pendingNonce) {
      return res.status(400).json({
        error: "Nonce yaroqsiz yoki muddati tugagan",
        code: "NONCE_EXPIRED",
        message: "Iltimos, QR kodni qayta skanerlang",
      });
    }

    // Stol va restoran ma'lumotlarini olish
    const table = await Table.findById(tableId);
    if (!table) {
      return res.status(404).json({ error: "Stol topilmadi" });
    }

    const restaurant = await Restaurant.findById(pendingNonce.restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restoran topilmadi" });
    }

    // Restoran obunasini tekshirish
    const subscriptionStatus = restaurant.checkSubscription();
    if (subscriptionStatus.status === "blocked") {
      return res.status(403).json({
        error: "Restoran xizmati vaqtincha to'xtatilgan",
        code: "RESTAURANT_BLOCKED",
      });
    }

    // Sessiya muddatini hisoblash (default: 60 daqiqa)
    const sessionDuration = restaurant.settings?.sessionDuration || 60;
    const expiresAt = new Date(Date.now() + sessionDuration * 60 * 1000);

    // Sessiya yaratish
    const sessionToken = QRSession.generateToken();
    const session = await QRSession.create({
      sessionToken,
      restaurantId: restaurant._id,
      tableId: table._id,
      expiresAt,
      clientHash: clientHash || null,
    });

    res.json({
      success: true,
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      expiresIn: sessionDuration * 60, // sekundlarda
      table: {
        id: table._id,
        name: table.title,
        number: table.tableNumber,
        surcharge: table.surcharge,
      },
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        logo: restaurant.logo,
        slug: restaurant.slug,
      },
    });
  } catch (error) {
    console.error("Session creation error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Sessiya holatini tekshirish
router.get("/qr/session/status", async (req, res) => {
  try {
    const sessionToken =
      req.headers["x-session-token"] || req.query.sessionToken;

    if (!sessionToken) {
      return res.json({
        valid: false,
        reason: "NO_SESSION",
      });
    }

    const session = await QRSession.findOne({
      sessionToken,
      status: "active",
    })
      .populate("tableId")
      .populate("restaurantId");

    if (!session) {
      return res.json({
        valid: false,
        reason: "SESSION_NOT_FOUND",
      });
    }

    const now = new Date();
    if (now >= session.expiresAt) {
      return res.json({
        valid: false,
        reason: "SESSION_EXPIRED",
        expiredAt: session.expiresAt.toISOString(),
      });
    }

    // Qolgan vaqtni hisoblash
    const remainingMs = session.expiresAt.getTime() - now.getTime();
    const remainingMinutes = Math.floor(remainingMs / 60000);

    res.json({
      valid: true,
      expiresAt: session.expiresAt.toISOString(),
      remainingMinutes,
      table: {
        id: session.tableId._id,
        name: session.tableId.title,
        number: session.tableId.tableNumber,
        surcharge: session.tableId.surcharge,
      },
      restaurant: {
        id: session.restaurantId._id,
        name: session.restaurantId.name,
        logo: session.restaurantId.logo,
        slug: session.restaurantId.slug,
      },
    });
  } catch (error) {
    console.error("Session status error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Sessiyani uzaytirish (oxirgi 15 daqiqada)
router.post("/qr/session/extend", validateQRSession, async (req, res) => {
  try {
    const session = req.qrSession;
    const restaurant = req.restaurant;

    const now = new Date();
    const timeRemaining = session.expiresAt.getTime() - now.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (timeRemaining > fifteenMinutes) {
      return res.status(400).json({
        error: "Hali sessiyani uzaytirish mumkin emas",
        message: "Sessiya oxirgi 15 daqiqada uzaytirilishi mumkin",
        canExtendAt: new Date(
          session.expiresAt.getTime() - fifteenMinutes
        ).toISOString(),
      });
    }

    // 30 daqiqaga uzaytirish
    const newExpiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    session.expiresAt = newExpiresAt;
    await session.save();

    res.json({
      success: true,
      newExpiresAt: newExpiresAt.toISOString(),
      extendedMinutes: 30,
    });
  } catch (error) {
    console.error("Session extension error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Sessiyani tugatish
router.post("/qr/session/end", validateQRSession, async (req, res) => {
  try {
    const session = req.qrSession;

    session.status = "expired";
    await session.save();

    res.json({
      success: true,
      message: "Sessiya tugatildi",
    });
  } catch (error) {
    console.error("Session end error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

module.exports = router;
