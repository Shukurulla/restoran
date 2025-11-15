const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const multer = require("multer");
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

router.get("/foods", cors(), async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});

router.post("/foods-create", cors(), upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file
      ? `/images/foods/${req.file.filename}`
      : "";

    const foodData = {
      ...req.body,
      image: imageUrl,
    };

    await Food.create(foodData);
    const food = await Food.find();
    res.json({ data: food });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/edit-food/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Food.findByIdAndUpdate(id, req.body);
  const data = await Food.find();
  res.json({ data: data });
});
router.post("/delete-food/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Food.findByIdAndRemove(id);
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
