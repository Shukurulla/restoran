const express = require("express");
const Food = require("../models/foods");
const router = express.Router();
const cors = require("cors");
const multer = require("multer");
const path = require("path");

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
  upload.single("image"),
  async (req, res) => {
    await Food.create({ ...req.body, image: req.file.filename });
    const foods = await Food.find();
    res.json({ data: foods });
    console.log(req.body);
  }
);
router.post(
  "/edit-food/:id",
  cors(),
  upload.single("image"),
  async (req, res) => {
    const id = req.params.id;
    await Food.findByIdAndUpdate(
      id,
      req.body.isEdit == true
        ? { ...req.body, image: req.file.filename }
        : req.body
    );
    const data = await Food.find();
    res.json({ data: data });
  }
);
router.post("/delete-food/:id", cors(), async (req, res) => {
  const id = req.params.id;
  await Food.findByIdAndRemove(id);
  const foods = await Food.find();
  res.json({ data: foods });
});

module.exports = router;
