const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/Images");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
});

router.get("/foods", cors(), async (req, res) => {
  const foods = await Food.find();
  res.json({ data: foods });
});
router.post(
  "/foods-create",
  cors(),
  upload.single("file"),
  async (req, res) => {
    await Food.create(req.body);
    const foods = await Food.find();
    res.json({ data: foods });
  }
);

module.exports = router;
