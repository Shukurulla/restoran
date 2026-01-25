const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const multer = require("multer");
const { authenticateRestaurantAdmin, authenticateStaff } = require("../middleware/auth");
const path = require("path");
const fs = require("fs");

// Images papkasini yaratish
const imagesDir = path.join(__dirname, "../public/images/foods");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Multer konfiguratsiyasi
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "food-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Faqat rasm fayllari qabul qilinadi!"));
  },
});

router.get("/foods", cors(), authenticateRestaurantAdmin, async (req, res) => {
  const foods = await Food.find({ restaurantId: req.restaurantId });
  res.json({ data: foods });
});

// Waiter uchun taomlarni olish
router.get("/waiter/foods", cors(), authenticateStaff, async (req, res) => {
  try {
    const foods = await Food.find({
      restaurantId: req.restaurantId,
      isAvailable: { $ne: false },
    });
    res.json({ data: foods });
  } catch (error) {
    console.error("Waiter foods error:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/foods-create", cors(), authenticateRestaurantAdmin, upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file
      ? `/images/foods/${req.file.filename}`
      : "";
  
    const foodData = {
      ...req.body,
      image: imageUrl,
      dosage: "1 porsiya",
       body: req.body.foodName,
      restaurantId: req.restaurantId,
      isAvailable: true,
            inStopList: false, // Faqat o'z restorani uchun yaratish
    };

    await Food.create(foodData);
    const food = await Food.find({ restaurantId: req.restaurantId });
    res.json({ data: food });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/edit-food/:id", cors(), authenticateRestaurantAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = req.params.id;
    // Faqat o'z restoranining taomini tahrirlash
    const food = await Food.findOne({ _id: id, restaurantId: req.restaurantId });
    if (!food) {
      return res.status(404).json({ error: "Taom topilmadi" });
    }

    // Yangi rasm yuklangan bo'lsa
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image = `/images/foods/${req.file.filename}`;

      // Eski rasmni o'chirish (agar local rasm bo'lsa)
      if (food.image && food.image.startsWith('/images/foods/')) {
        const oldImagePath = path.join(__dirname, "../public", food.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    await Food.findByIdAndUpdate(id, updateData);
    const data = await Food.find({ restaurantId: req.restaurantId });
    res.json({ data: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/delete-food/:id", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    // Faqat o'z restoranining taomini o'chirish
    const food = await Food.findOne({ _id: id, restaurantId: req.restaurantId });
    if (!food) {
      return res.status(404).json({ error: "Taom topilmadi" });
    }
    await Food.findByIdAndRemove(id);
    const foods = await Food.find({ restaurantId: req.restaurantId });
    res.json({ data: foods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STOP LIST ============

// Stop list - sotuvda mavjud emas taomlar
router.get("/foods/stop-list", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const stopListFoods = await Food.find({
      restaurantId: req.restaurantId,
      inStopList: true,
    });
    res.json({ data: stopListFoods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Taomni stop list'ga qo'shish
router.patch("/foods/:id/stop-list", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { inStopList } = req.body;

    const food = await Food.findOneAndUpdate(
      { _id: id, restaurantId: req.restaurantId },
      { inStopList: inStopList },
      { new: true }
    );

    if (!food) {
      return res.status(404).json({ error: "Taom topilmadi" });
    }

    res.json({ success: true, food });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bir nechta taomni stop list'ga qo'shish/olib tashlash
router.patch("/foods/stop-list/bulk", cors(), authenticateRestaurantAdmin, async (req, res) => {
  try {
    const { foodIds, inStopList } = req.body;

    await Food.updateMany(
      { _id: { $in: foodIds }, restaurantId: req.restaurantId },
      { inStopList: inStopList }
    );

    const foods = await Food.find({ restaurantId: req.restaurantId });
    res.json({ success: true, data: foods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
